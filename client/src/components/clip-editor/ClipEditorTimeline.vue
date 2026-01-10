<template>
  <div class="transition-all duration-300 ease-in-out h-full">
    <div class="pt-2 px-3 pb-1 flex flex-col h-full gap-2">
      <!-- Timeline Header - Redesigned CapCut Style -->
      <div class="flex items-center justify-between pr-2 flex-shrink-0 text-white/70 text-[12px]">
        <div class="flex items-center gap-2">
          <!-- Selection & Edit Tools Group -->
          <div class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04]">
            <button
              @click="setTool('move')"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isMoveTool
                  ? 'text-cyan-300 bg-gradient-to-b from-cyan-500/25 to-cyan-600/15 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/8',
              ]"
              title="Move Tool (V)"
            >
              <MousePointer2 :size="14" />
            </button>
            <button
              @click="setTool('razor')"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isRazorTool
                  ? 'text-cyan-300 bg-gradient-to-b from-cyan-500/25 to-cyan-600/15 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/8',
              ]"
              title="Razor Tool (C)"
            >
              <Scissors :size="14" />
            </button>
            <button
              @click="setTool('ripple')"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isRippleTool
                  ? 'text-cyan-300 bg-gradient-to-b from-cyan-500/25 to-cyan-600/15 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/8',
              ]"
              title="Ripple Edit (B)"
            >
              <MoveHorizontal :size="14" />
            </button>
            <button
              @click="setTool('roll')"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isRollTool
                  ? 'text-cyan-300 bg-gradient-to-b from-cyan-500/25 to-cyan-600/15 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/8',
              ]"
              title="Roll Edit (N)"
            >
              <Columns :size="14" />
            </button>
            <button
              @click="setTool('slip')"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isSlipTool
                  ? 'text-cyan-300 bg-gradient-to-b from-cyan-500/25 to-cyan-600/15 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/8',
              ]"
              title="Slip Tool (Y)"
            >
              <ArrowLeftRight :size="14" />
            </button>
            <button
              @click="setTool('slide')"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isSlideTool
                  ? 'text-cyan-300 bg-gradient-to-b from-cyan-500/25 to-cyan-600/15 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                  : 'text-white/50 hover:text-white hover:bg-white/8',
              ]"
              title="Slide Tool (U)"
            >
              <BoxSelect :size="14" />
            </button>
          </div>

          <!-- Actions Group -->
          <div class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04]">
            <button
              @click="performCutAtPlayhead"
              class="p-1.5 rounded-md transition-all duration-150 text-orange-400/70 hover:text-orange-300 hover:bg-orange-500/15"
              title="Split at playhead (Ctrl+K)"
            >
              <Scissors :size="14" />
              <span class="sr-only">Split</span>
            </button>
            <div class="w-px h-4 bg-white/8 mx-0.5"></div>
            <button
              @click="emit('undo')"
              :disabled="!canUndo"
              class="p-1.5 rounded-md transition-all duration-150 text-white/50 hover:text-blue-300 hover:bg-blue-500/15 disabled:text-white/15 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Undo (Ctrl+Z)"
            >
              <Undo2 :size="14" />
            </button>
            <button
              @click="emit('redo')"
              :disabled="!canRedo"
              class="p-1.5 rounded-md transition-all duration-150 text-white/50 hover:text-blue-300 hover:bg-blue-500/15 disabled:text-white/15 disabled:cursor-not-allowed disabled:hover:bg-transparent"
              title="Redo (Ctrl+Y)"
            >
              <Redo2 :size="14" />
            </button>
          </div>

          <!-- Playback Controls Group -->
          <div class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04]">
            <button
              @mousedown="startContinuousSeeking('reverse')"
              @mouseup="stopContinuousSeeking"
              @mouseleave="stopContinuousSeeking"
              @touchstart="startContinuousSeeking('reverse')"
              @touchend="stopContinuousSeeking"
              :class="[
                'p-1.5 rounded-md transition-all duration-150',
                isSeeking && seekDirection === 'reverse'
                  ? 'text-amber-300 bg-gradient-to-b from-amber-500/25 to-amber-600/15 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : 'text-white/50 hover:text-amber-300 hover:bg-amber-500/15',
              ]"
              title="Seek backward (← arrow key)"
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
                'p-1.5 rounded-md transition-all duration-150',
                isSeeking && seekDirection === 'forward'
                  ? 'text-amber-300 bg-gradient-to-b from-amber-500/25 to-amber-600/15 shadow-[0_0_8px_rgba(245,158,11,0.2)]'
                  : 'text-white/50 hover:text-amber-300 hover:bg-amber-500/15',
              ]"
              title="Seek forward (→ arrow key)"
            >
              <FastForward :size="14" />
            </button>
          </div>
        </div>

        <!-- Right Side Controls -->
        <div class="flex items-center gap-2">
          <!-- Snap Settings -->
          <div class="relative group/snap">
            <button
              class="flex items-center gap-1.5 text-[11px] px-2.5 py-1.5 rounded-lg border transition-all duration-150"
              :class="
                snapEnabled
                  ? 'text-violet-300 bg-violet-500/15 border-violet-500/30 shadow-[0_0_8px_rgba(139,92,246,0.15)]'
                  : 'text-white/50 bg-[#161618] border-white/[0.04] hover:bg-white/8'
              "
              @click="snapMenuOpen = !snapMenuOpen"
            >
              <Magnet :size="12" :class="snapEnabled ? 'text-violet-400' : 'text-white/40'" />
              <span class="font-medium">Snap</span>
              <ChevronDown :size="10" :class="snapEnabled ? 'text-violet-400/60' : 'text-white/30'" />
            </button>
            <!-- Snap options dropdown -->
            <div
              v-if="snapMenuOpen"
              class="absolute right-0 top-full mt-1.5 bg-[#1c1c1e] border border-white/10 rounded-lg shadow-2xl py-1.5 min-w-[190px] z-[100]"
              @mouseleave="snapMenuOpen = false"
            >
              <div class="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider font-medium">
                Snap Settings
              </div>
              <label class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer">
                <input type="checkbox" v-model="snapEnabled" class="accent-violet-500 h-3.5 w-3.5 rounded" />
                <span class="text-sm text-white/80">Enable Snapping</span>
              </label>
              <div class="h-px bg-white/8 my-1"></div>
              <div class="px-3 py-1 text-[10px] text-white/40 uppercase tracking-wider font-medium">Snap To</div>
              <label
                class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer"
                :class="!snapEnabled && 'opacity-40'"
              >
                <input
                  type="checkbox"
                  v-model="snapPreferences.playhead"
                  :disabled="!snapEnabled"
                  class="accent-violet-500 h-3.5 w-3.5 rounded"
                />
                <span class="text-sm text-white/80">Playhead</span>
              </label>
              <label
                class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer"
                :class="!snapEnabled && 'opacity-40'"
              >
                <input
                  type="checkbox"
                  v-model="snapPreferences.segmentEdges"
                  :disabled="!snapEnabled"
                  class="accent-violet-500 h-3.5 w-3.5 rounded"
                />
                <span class="text-sm text-white/80">Segment Edges</span>
              </label>
              <label
                class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer"
                :class="!snapEnabled && 'opacity-40'"
              >
                <input
                  type="checkbox"
                  v-model="snapPreferences.markers"
                  :disabled="!snapEnabled"
                  class="accent-violet-500 h-3.5 w-3.5 rounded"
                />
                <span class="text-sm text-white/80">Markers</span>
              </label>
              <label
                class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer"
                :class="!snapEnabled && 'opacity-40'"
              >
                <input
                  type="checkbox"
                  v-model="snapPreferences.grid"
                  :disabled="!snapEnabled"
                  class="accent-violet-500 h-3.5 w-3.5 rounded"
                />
                <span class="text-sm text-white/80">Grid (1s intervals)</span>
              </label>
              <div class="h-px bg-white/8 my-1"></div>
              <div class="px-3 py-1 text-[10px] text-white/40 uppercase tracking-wider font-medium">Behavior</div>
              <label
                class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer"
                :class="!snapEnabled && 'opacity-40'"
              >
                <input
                  type="checkbox"
                  v-model="snapPreferences.magnetic"
                  :disabled="!snapEnabled"
                  class="accent-violet-500 h-3.5 w-3.5 rounded"
                />
                <span class="text-sm text-white/80">Magnetic Timeline</span>
              </label>
              <label class="flex items-center gap-2.5 px-3 py-2 hover:bg-white/8 cursor-pointer">
                <input type="checkbox" v-model="frameSnapEnabled" class="accent-violet-500 h-3.5 w-3.5 rounded" />
                <span class="text-sm text-white/80">Snap to Frames</span>
              </label>
            </div>
          </div>

          <!-- Segment Count Badge -->
          <span
            v-if="sortedTrimSegments.length > 1"
            class="text-[11px] text-violet-300 bg-violet-500/15 px-2.5 py-1.5 rounded-lg font-medium border border-violet-500/20"
          >
            {{ sortedTrimSegments.length }} segments
          </span>

          <!-- Duration Badge -->
          <span
            class="text-[11px] text-white/60 bg-[#161618] px-2.5 py-1.5 rounded-lg font-mono tabular-nums border border-white/[0.04]"
          >
            {{ formatTime(totalDuration) }}
          </span>

          <!-- Zoom Controls Group (far right) -->
          <div
            class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04] relative group/zoom"
          >
            <button
              @click="zoomOut"
              :disabled="zoomLevel <= MIN_ZOOM"
              class="p-1 rounded-md transition-all duration-150 text-white/50 hover:text-white hover:bg-white/10 disabled:text-white/15 disabled:cursor-not-allowed"
              title="Zoom out"
            >
              <Minus :size="13" />
            </button>
            <button
              @click="zoomMenuOpen = !zoomMenuOpen"
              class="text-[11px] text-white/70 font-mono tabular-nums min-w-[52px] text-center select-none px-1.5 py-0.5 rounded hover:bg-white/8 transition-colors cursor-pointer"
              title="Select zoom level"
            >
              {{ getZoomDisplayText() }}
            </button>

            <!-- Zoom Presets Dropdown -->
            <div
              v-if="zoomMenuOpen"
              class="absolute top-full right-0 mt-1.5 bg-[#1c1c1e] border border-white/10 rounded-lg shadow-2xl py-1.5 min-w-[150px] z-[100]"
              @mouseleave="zoomMenuOpen = false"
            >
              <div class="px-3 py-1.5 text-[10px] text-white/40 uppercase tracking-wider font-medium">Zoom Presets</div>
              <button
                class="w-full px-3 py-2 text-left text-sm hover:bg-white/8 flex items-center justify-between text-white/80"
                @click="
                  () => {
                    zoomToFit();
                    zoomMenuOpen = false;
                  }
                "
              >
                <span>Fit to Screen</span>
                <span class="text-white/30 text-xs font-mono">Z</span>
              </button>
              <button
                class="w-full px-3 py-2 text-left text-sm hover:bg-white/8 flex items-center justify-between text-white/80"
                @click="
                  () => {
                    zoomToSelection();
                    zoomMenuOpen = false;
                  }
                "
              >
                <span>Fit Selection</span>
                <span class="text-white/30 text-xs font-mono">⇧Z</span>
              </button>
              <div class="h-px bg-white/8 my-1"></div>
              <button
                class="w-full px-3 py-2 text-left text-sm hover:bg-white/8 text-white/80"
                @click="
                  () => {
                    zoomLevel = 1.0;
                    zoomMenuOpen = false;
                  }
                "
              >
                <span>100% (Baseline)</span>
              </button>
              <button
                class="w-full px-3 py-2 text-left text-sm hover:bg-white/8 text-white/80"
                @click="
                  () => {
                    zoomLevel = 2.0;
                    zoomMenuOpen = false;
                  }
                "
              >
                <span>200%</span>
              </button>
              <button
                class="w-full px-3 py-2 text-left text-sm hover:bg-white/8 text-white/80"
                @click="
                  () => {
                    zoomLevel = 5.0;
                    zoomMenuOpen = false;
                  }
                "
              >
                <span>500%</span>
              </button>
            </div>

            <button
              @click="zoomIn"
              class="p-1 rounded-md transition-all duration-150 text-white/50 hover:text-white hover:bg-white/10"
              title="Zoom in"
            >
              <Plus :size="13" />
            </button>
          </div>
        </div>
      </div>

      <!-- Timeline Tracks Container -->
      <div
        ref="timelineScrollContainer"
        class="bg-[#0d0d0d] rounded-lg relative overflow-y-auto overflow-x-auto flex-1 min-h-0 scrollbar-thin scrollbar-thumb-[#3a3a3a] scrollbar-track-[#0d0d0d] border border-white/[0.03] flex flex-col"
        :style="{ cursor: getTimelineCursor() }"
        @mousemove="onTimelineMouseMove"
        @mouseleave="onTimelineMouseLeave"
        @click="onTimelineContainerClick"
        @wheel="onTimelineWheel"
        @scroll="onTimelineScroll"
      >
        <!-- Marquee Selection Rectangle -->
        <div
          v-if="marqueeStyle"
          class="absolute border-2 border-cyan-500 bg-cyan-500/15 pointer-events-none z-[100] rounded"
          :style="marqueeStyle"
        ></div>

        <!-- Drag Ghost Element - positioned via direct DOM manipulation for zero-lag dragging -->
        <div
          ref="dragGhostRef"
          v-show="dragGhostState?.visible"
          class="fixed pointer-events-none z-[1000] rounded-md shadow-2xl opacity-90"
          :class="{
            'bg-violet-600/80 border-2 border-violet-400': dragGhostState?.color === 'violet',
            'bg-cyan-600/80 border-2 border-cyan-400': dragGhostState?.color === 'cyan',
            'bg-emerald-600/80 border-2 border-emerald-400': dragGhostState?.color === 'emerald',
            'bg-amber-600/80 border-2 border-amber-400': dragGhostState?.color === 'amber',
            'bg-rose-600/80 border-2 border-rose-400': dragGhostState?.color === 'rose',
          }"
          :style="{
            left: `${dragGhostState?.initialLeft ?? 0}px`,
            top: `${dragGhostState?.initialTop ?? 0}px`,
            width: `${dragGhostState?.width ?? 100}px`,
            height: `${dragGhostState?.height ?? 36}px`,
            willChange: 'transform',
          }"
        >
          <div class="flex items-center justify-center h-full px-2">
            <span class="text-xs text-white font-medium truncate drop-shadow-md">
              {{ dragGhostState?.label || '' }}
            </span>
          </div>
        </div>
        <!-- Horizontal scroller for ruler + tracks -->
        <div class="pb-1 flex-1">
          <!-- Timeline Content Wrapper - handles zoom width -->
          <div
            ref="contentWrapperRef"
            class="timeline-content-wrapper relative"
            :class="{ dragging: isDragging || isResizing }"
            :style="{ width: `${Math.max(1, zoomLevel) * 100}%`, minHeight: '100%' }"
          >
            <!-- Full-width Timestamp Ruler - Enhanced -->
            <div
              class="h-8 border-b border-white/[0.08] flex items-center bg-gradient-to-b from-[#141416] to-[#0d0d0d] sticky top-0 z-[80] timeline-ruler"
              @wheel="onRulerWheel"
              title="Scroll to zoom"
            >
              <!-- Track label spacer - matches track header width -->
              <div
                class="w-[120px] h-full flex items-center justify-start pl-3 gap-2 flex-shrink-0 sticky left-0 z-[90] bg-gradient-to-b from-[#141416] to-[#0d0d0d] border-r border-white/[0.06]"
              >
                <span class="text-[10px] font-medium text-white/50 uppercase tracking-wider">Timeline</span>
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
                    :style="{
                      left: `${tick.percent}%`,
                      transform: tick.time === 0 ? 'translateX(0)' : 'translateX(-50%)',
                      bottom: '0',
                    }"
                  >
                    <div
                      class="timeline-tick"
                      :class="tick.isMajor ? 'w-px h-4 bg-white/30' : 'w-px h-2 bg-white/15'"
                    ></div>
                    <span
                      v-if="tick.isMajor"
                      class="text-[11px] text-white/50 whitespace-nowrap font-medium tabular-nums mt-0.5"
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
                  <!-- Marker flag icon with dynamic color -->
                  <div
                    class="w-6 h-6 flex items-center justify-center rounded-full transition-all duration-150"
                    :style="{
                      backgroundColor: marker.color || '#eab308',
                      boxShadow:
                        props.selectedMarkerId === marker.id ? `0 4px 6px -1px ${marker.color || '#eab308'}80` : 'none',
                      opacity: props.selectedMarkerId === marker.id ? 1 : 0.8,
                    }"
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
                  <!-- Marker line with dynamic color -->
                  <div
                    class="w-0.5 h-full transition-all duration-150"
                    :style="{
                      backgroundColor: marker.color || '#eab308',
                      opacity: props.selectedMarkerId === marker.id ? 1 : 0.6,
                    }"
                  ></div>
                </div>

                <!-- Beat Markers (auto-detected from audio) -->
                <div
                  v-for="beatMarker in visibleBeatMarkers"
                  :key="`beat-${beatMarker.id}`"
                  class="absolute top-0 bottom-0 flex flex-col items-center z-[55] pointer-events-none"
                  :style="{ left: `${beatMarker.leftPercent}%`, transform: 'translateX(-50%)' }"
                  :title="`Beat (${Math.round((beatMarker.confidence || 0) * 100)}% confidence)`"
                >
                  <!-- Beat marker tick -->
                  <div
                    class="w-1 h-3 rounded-full"
                    :style="{
                      backgroundColor: `rgba(236, 72, 153, ${0.4 + (beatMarker.confidence || 0.5) * 0.6})`,
                    }"
                  ></div>
                  <!-- Beat marker line -->
                  <div
                    class="w-px h-full"
                    :style="{
                      backgroundColor: `rgba(236, 72, 153, ${0.2 + (beatMarker.confidence || 0.5) * 0.3})`,
                    }"
                  ></div>
                </div>

                <!-- Chapter Markers (for export metadata) -->
                <div
                  v-for="chapterMarker in visibleChapterMarkers"
                  :key="`chapter-${chapterMarker.id}`"
                  class="absolute top-0 bottom-0 flex flex-col items-center cursor-pointer z-[58] group"
                  :style="{ left: `${chapterMarker.leftPercent}%`, transform: 'translateX(-50%)' }"
                  :title="chapterMarker.title"
                  @click.stop="emit('chapterMarkerClick', chapterMarker.id)"
                >
                  <!-- Chapter marker flag -->
                  <div
                    class="w-5 h-5 flex items-center justify-center rounded bg-indigo-500 text-white text-[9px] font-bold shadow-md"
                  >
                    CH
                  </div>
                  <!-- Chapter marker line -->
                  <div class="w-0.5 h-full bg-indigo-500/60"></div>
                </div>
              </div>
            </div>

            <!-- Unified Layer tracks (can contain video sources, text, stickers, watermarks) -->
            <div
              v-for="layerGroup in visualLayers"
              :key="`layer-${layerGroup.layer}`"
              :data-layer-track="layerGroup.layer"
              class="flex items-center h-11 relative border-b border-white/[0.04]"
              :class="{
                'bg-purple-500/10 ring-2 ring-purple-500/40 ring-inset':
                  (isDragging &&
                    dragInfo?.type &&
                    ['text', 'sticker', 'watermark'].includes(dragInfo.type) &&
                    dragInfo?.targetLayer === layerGroup.layer) ||
                  (isDraggingSource && dragSourceInfo?.targetTrackIndex === layerGroup.layer),
              }"
            >
              <div
                class="track-label w-[120px] h-full pl-3 flex items-center gap-2 text-xs sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06]"
              >
                <div class="w-5 h-5 rounded bg-purple-500/20 flex items-center justify-center">
                  <span class="text-[10px] font-bold text-purple-400">{{ layerGroup.layer }}</span>
                </div>
                <span class="font-medium text-white/60">Layer</span>
              </div>
              <div class="flex-1 h-full relative z-[10]" @click="onTrackContentClick">
                <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>

                <!-- Extended timeline area indicator (beyond source videos) -->
                <div
                  v-if="sourcesEndTime > 0 && totalDuration > sourcesEndTime"
                  class="absolute top-0 bottom-0 bg-gradient-to-r from-transparent to-white/[0.03] pointer-events-none"
                  :style="{
                    left: `${(sourcesEndTime / totalDuration) * 100}%`,
                    right: '0',
                  }"
                >
                  <div class="absolute left-0 top-0 bottom-0 w-px bg-white/10"></div>
                </div>

                <!-- Render all items in this layer -->
                <template v-for="overlayItem in layerGroup.items" :key="`${overlayItem.type}-${overlayItem.item.id}`">
                  <!-- Video Source (in layer) -->
                  <div
                    v-if="overlayItem.type === 'source'"
                    :ref="(el) => setSegmentRef(el, 'source', overlayItem.item.id)"
                    class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group border-2 border-cyan-500"
                    :class="getSegmentClasses('source', overlayItem.item.id)"
                    :style="getVideoSourceStyle(overlayItem.item, dragPreview)"
                    @mousedown="(e) => onSourceMouseDown(e, overlayItem.item)"
                    @click.stop="selectItem('source', overlayItem.item.id)"
                  >
                    <div class="absolute inset-0 bg-[#161618]"></div>
                    <span
                      class="relative z-10 text-xs text-cyan-400 font-medium truncate px-1 drop-shadow-sm pointer-events-none"
                    >
                      {{ overlayItem.item.source_name || 'Video' }}
                    </span>
                    <!-- Keyframes -->
                    <KeyframeMarker
                      v-for="kf in overlayItem.item.keyframes"
                      :key="kf.id"
                      :property="kf.property"
                      :value="kf.value"
                      :is-selected="selectedKeyframeId === kf.id"
                      :style="{ left: `${(kf.time / (overlayItem.item.endTime - overlayItem.item.startTime)) * 100}%` }"
                      @mousedown.stop="
                        (e) =>
                          startKeyframeDrag(
                            e,
                            kf,
                            overlayItem.item.id,
                            'source',
                            overlayItem.item.endTime - overlayItem.item.startTime
                          )
                      "
                    />
                    <!-- Left resize handle -->
                    <div
                      class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-cyan-500/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-cyan-500/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'source', overlayItem.item.id, 'left', overlayItem.item)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                    <!-- Right resize handle -->
                    <div
                      class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-cyan-500/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-cyan-500/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'source', overlayItem.item.id, 'right', overlayItem.item)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                  </div>

                  <!-- Sticker -->
                  <div
                    v-if="overlayItem.type === 'sticker'"
                    :ref="(el) => setSegmentRef(el, 'sticker', overlayItem.item.id)"
                    class="clip-segment absolute top-1 bottom-1 rounded-md flex items-center justify-center group"
                    :class="getSegmentClasses('sticker', overlayItem.item.id)"
                    :style="
                      getSegmentStyle(
                        overlayItem.item.startTime,
                        overlayItem.item.endTime,
                        'pink',
                        'sticker',
                        overlayItem.item.id
                      )
                    "
                    @mousedown="(e) => onSegmentMouseDown(e, 'sticker', overlayItem.item.id, overlayItem.item)"
                    @click.stop="selectItem('sticker', overlayItem.item.id)"
                  >
                    <span v-if="overlayItem.item.stickerType === 'emoji'" class="text-sm pointer-events-none">
                      {{ overlayItem.item.stickerPath }}
                    </span>
                    <span
                      v-else
                      class="text-xs text-white/90 font-medium truncate px-1 drop-shadow-sm pointer-events-none"
                    >
                      Sticker
                    </span>
                    <!-- Keyframes -->
                    <KeyframeMarker
                      v-for="kf in overlayItem.item.keyframes"
                      :key="kf.id"
                      :property="kf.property"
                      :value="kf.value"
                      :is-selected="selectedKeyframeId === kf.id"
                      :style="{ left: `${(kf.time / (overlayItem.item.endTime - overlayItem.item.startTime)) * 100}%` }"
                      @mousedown.stop="
                        (e) =>
                          startKeyframeDrag(
                            e,
                            kf,
                            overlayItem.item.id,
                            'sticker',
                            overlayItem.item.endTime - overlayItem.item.startTime
                          )
                      "
                    />
                    <!-- Left resize handle -->
                    <div
                      class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'sticker', overlayItem.item.id, 'left', overlayItem.item)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                    <!-- Right resize handle -->
                    <div
                      class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'sticker', overlayItem.item.id, 'right', overlayItem.item)
                      "
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
                    :style="
                      getSegmentStyle(
                        overlayItem.item.startTime,
                        overlayItem.item.endTime,
                        'amber',
                        'text',
                        overlayItem.item.id
                      )
                    "
                    @mousedown="(e) => onSegmentMouseDown(e, 'text', overlayItem.item.id, overlayItem.item)"
                    @click.stop="selectItem('text', overlayItem.item.id)"
                  >
                    <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                      {{ overlayItem.item.text }}
                    </span>
                    <!-- Keyframes -->
                    <KeyframeMarker
                      v-for="kf in overlayItem.item.keyframes"
                      :key="kf.id"
                      :property="kf.property"
                      :value="kf.value"
                      :is-selected="selectedKeyframeId === kf.id"
                      :style="{ left: `${(kf.time / (overlayItem.item.endTime - overlayItem.item.startTime)) * 100}%` }"
                      @mousedown.stop="
                        (e) =>
                          startKeyframeDrag(
                            e,
                            kf,
                            overlayItem.item.id,
                            'text',
                            overlayItem.item.endTime - overlayItem.item.startTime
                          )
                      "
                    />
                    <!-- Left resize handle -->
                    <div
                      class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'text', overlayItem.item.id, 'left', overlayItem.item)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                    <!-- Right resize handle -->
                    <div
                      class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'text', overlayItem.item.id, 'right', overlayItem.item)
                      "
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
                    :style="
                      getSegmentStyle(
                        overlayItem.item.startTime,
                        overlayItem.item.endTime,
                        'cyan',
                        'watermark',
                        overlayItem.item.id
                      )
                    "
                    @mousedown="(e) => onSegmentMouseDown(e, 'watermark', overlayItem.item.id, overlayItem.item)"
                    @click.stop="selectItem('watermark', overlayItem.item.id)"
                  >
                    <span class="text-xs text-white/90 font-medium truncate drop-shadow-sm pointer-events-none">
                      Watermark
                    </span>
                    <!-- Keyframes -->
                    <KeyframeMarker
                      v-for="kf in overlayItem.item.keyframes"
                      :key="kf.id"
                      :property="kf.property"
                      :value="kf.value"
                      :is-selected="selectedKeyframeId === kf.id"
                      :style="{ left: `${(kf.time / (overlayItem.item.endTime - overlayItem.item.startTime)) * 100}%` }"
                      @mousedown.stop="
                        (e) =>
                          startKeyframeDrag(
                            e,
                            kf,
                            overlayItem.item.id,
                            'watermark',
                            overlayItem.item.endTime - overlayItem.item.startTime
                          )
                      "
                    />
                    <!-- Left resize handle -->
                    <div
                      class="resize-handle absolute -left-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'watermark', overlayItem.item.id, 'left', overlayItem.item)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                    <!-- Right resize handle -->
                    <div
                      class="resize-handle absolute -right-1 top-0 bottom-0 w-2 bg-white/40 opacity-0 transition-all duration-150 cursor-ew-resize pointer-events-none flex items-center justify-center rounded-full hover:bg-white/60 group-hover:opacity-100 group-hover:pointer-events-auto z-20"
                      @mousedown.stop="
                        (e) => onResizeMouseDown(e, 'watermark', overlayItem.item.id, 'right', overlayItem.item)
                      "
                    >
                      <div class="w-1 h-4 bg-white rounded-full shadow-md"></div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- Legacy single tracks (kept for backward compatibility if no layers defined) -->
            <div
              v-if="textOverlays.length > 0 && visualOverlayLayers.length === 0"
              class="flex items-center h-11 relative border-b border-white/[0.04]"
            >
              <div
                class="track-label w-[120px] h-full pl-3 flex items-center gap-2 text-xs sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06]"
              >
                <div class="w-5 h-5 rounded bg-amber-500/20 flex items-center justify-center">
                  <Type :size="11" class="text-amber-400" />
                </div>
                <span class="font-medium text-white/60">Text</span>
              </div>
              <div class="flex-1 h-full relative z-[10]" @click="onTrackContentClick">
                <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>
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
                  <!-- Keyframes -->
                  <KeyframeMarker
                    v-for="kf in overlay.keyframes"
                    :key="kf.id"
                    :property="kf.property"
                    :value="kf.value"
                    :is-selected="selectedKeyframeId === kf.id"
                    :style="{ left: `${(kf.time / (overlay.endTime - overlay.startTime)) * 100}%` }"
                    @mousedown.stop="
                      (e) => startKeyframeDrag(e, kf, overlay.id, 'text', overlay.endTime - overlay.startTime)
                    "
                  />
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

            <div v-if="effects.length > 0" class="flex items-center h-11 relative border-b border-white/[0.04]">
              <div
                class="track-label w-[120px] h-full pl-3 flex items-center gap-2 text-xs sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06]"
              >
                <div class="w-5 h-5 rounded bg-cyan-500/20 flex items-center justify-center">
                  <Sparkles :size="11" class="text-cyan-400" />
                </div>
                <span class="font-medium text-white/60">Effects</span>
              </div>
              <div class="flex-1 h-full relative z-[10]" @click="onTrackContentClick">
                <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>
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
                  <span
                    class="text-xs text-white/90 font-medium truncate drop-shadow-sm capitalize pointer-events-none"
                  >
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

            <div v-if="filterSegments.length > 0" class="flex items-center h-11 relative border-b border-white/[0.04]">
              <div
                class="track-label w-[120px] h-full pl-3 flex items-center gap-2 text-xs sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06]"
              >
                <div class="w-5 h-5 rounded bg-sky-500/20 flex items-center justify-center">
                  <Palette :size="11" class="text-sky-400" />
                </div>
                <span class="font-medium text-white/60">Filters</span>
              </div>
              <div class="flex-1 h-full relative z-[10]" @click="onTrackContentClick">
                <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>
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
                  <span
                    class="text-xs text-white/90 font-medium truncate drop-shadow-sm capitalize pointer-events-none"
                  >
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
              <div class="flex items-center h-[72px] relative border-b border-white/[0.04]">
                <div
                  class="track-label w-[120px] h-full pl-3 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06] border-l-2 border-l-violet-500"
                >
                  <!-- Track type icon and label -->
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center">
                      <Film :size="11" class="text-violet-400" />
                    </div>
                    <span class="font-medium text-white/70">Video</span>
                  </div>
                  <!-- Track controls row -->
                  <div class="flex items-center gap-0.5 text-white/40">
                    <button
                      @click.stop="toggleVideoTrackState('isLocked')"
                      class="p-1 rounded hover:bg-white/10 transition-colors"
                      :title="videoTrackState.isLocked ? 'Unlock' : 'Lock'"
                      :class="{ 'text-violet-400 bg-violet-500/15': videoTrackState.isLocked }"
                    >
                      <Lock v-if="videoTrackState.isLocked" :size="12" />
                      <Unlock v-else :size="12" />
                    </button>
                    <button
                      @click.stop="toggleVideoTrackState('isHidden')"
                      class="p-1 rounded hover:bg-white/10 transition-colors"
                      :title="videoTrackState.isHidden ? 'Show' : 'Hide'"
                      :class="{ 'text-violet-400 bg-violet-500/15': videoTrackState.isHidden }"
                    >
                      <EyeOff v-if="videoTrackState.isHidden" :size="12" />
                      <Eye v-else :size="12" />
                    </button>
                    <button
                      @click.stop="toggleVideoTrackState('isMuted')"
                      class="p-1 rounded hover:bg-white/10 transition-colors"
                      :title="videoTrackState.isMuted ? 'Unmute' : 'Mute'"
                      :class="{ 'text-violet-400 bg-violet-500/15': videoTrackState.isMuted }"
                    >
                      <VolumeX v-if="videoTrackState.isMuted" :size="12" />
                      <Volume2 v-else :size="12" />
                    </button>
                  </div>
                </div>
                <div
                  ref="videoTrackContentRef"
                  class="flex-1 h-full relative z-[10]"
                  @click="onTrackContentClick"
                  @mousedown="onTimelineMarqueeStart"
                  @dragover.prevent="onTimelineDragOver"
                  @drop.prevent="onTimelineDrop"
                >
                  <!-- Background - split into source area and extended area -->
                  <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>

                  <!-- Extended timeline area indicator (beyond source videos) -->
                  <div
                    v-if="sourcesEndTime > 0 && totalDuration > sourcesEndTime"
                    class="absolute top-0 bottom-0 bg-gradient-to-r from-transparent via-white/[0.02] to-white/[0.04] pointer-events-none"
                    :style="{
                      left: `${(sourcesEndTime / totalDuration) * 100}%`,
                      right: '0',
                    }"
                  >
                    <!-- Vertical line marking end of source content -->
                    <div class="absolute left-0 top-0 bottom-0 w-px bg-white/20"></div>
                  </div>

                  <!-- Empty state drop zone -->
                  <div
                    v-if="primaryVideoSources.length === 0"
                    class="absolute inset-0 flex items-center justify-center border-2 border-dashed border-white/12 rounded-md"
                    :class="{ 'border-violet-500/50 bg-violet-500/5': isDragOverTimeline }"
                  >
                    <span class="text-xs text-white/30">Drop sources here</span>
                  </div>

                  <!-- Ghost preview showing original position during drag -->
                  <div
                    v-if="dragGhostState?.visible && dragGhostState?.type === 'source' && isDraggingSource"
                    class="absolute top-0 bottom-0 rounded-md border-2 border-dashed border-cyan-500/40 bg-cyan-500/10 pointer-events-none z-10"
                    :style="getGhostPreviewStyle('source')"
                  ></div>

                  <!-- Primary video source segments -->
                  <div
                    v-for="source in primaryVideoSources"
                    :key="source.id"
                    :ref="(el) => setSegmentRef(el, 'source', source.id)"
                    role="button"
                    tabindex="0"
                    :aria-label="`Video clip: ${source.source_name || 'Untitled'}, duration ${formatTime(source.end_time - source.start_time)}, starts at ${formatTime(source.start_time)}`"
                    :aria-selected="selectedItemKey === `source_${source.id}`"
                    class="clip-segment absolute top-0 bottom-0 overflow-hidden group border-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 focus:ring-offset-black"
                    :class="[
                      getSegmentClasses('source', source.id),
                      isCutToolActive && cutHoverInfo?.segmentId === source.id
                        ? 'cursor-crosshair z-[35] shadow-xl border-orange-400 ring-2 ring-orange-400/50'
                        : isCutToolActive
                          ? 'cursor-crosshair z-[30] border-cyan-500'
                          : 'cursor-pointer border-cyan-500',
                      // Multi-select visual feedback
                      props.selectedSourceIds?.has(source.id)
                        ? 'ring-2 ring-blue-400 ring-offset-1 ring-offset-black shadow-lg shadow-blue-400/30'
                        : '',
                    ]"
                    :style="getVideoSourceStyle(source, dragPreview)"
                    @keydown.enter="selectItem('source', source.id)"
                    @keydown.delete="deleteSelectedItem"
                    @keydown.space.prevent="selectItem('source', source.id)"
                    @mouseenter="isCutToolActive && onSourceHoverForCut($event, source)"
                    @mousemove="isCutToolActive && onSourceHoverForCut($event, source)"
                    @mouseleave="isCutToolActive && (cutHoverInfo = null)"
                    @mousedown="
                      isCutToolActive ? onSourceClickForCut($event, source) : onSourceMouseDown($event, source)
                    "
                    @click.stop="!isCutToolActive && onSourceClick($event, source)"
                    @contextmenu.prevent="onSourceContextMenu($event, source)"
                  >
                    <!-- Video thumbnails background (filmstrip style) -->
                    <div class="absolute inset-0 bg-[#161618] flex overflow-hidden">
                      <!-- Loading placeholder skeleton -->
                      <div v-if="!source.source_thumbnail" class="absolute inset-0 flex items-center justify-center">
                        <div class="flex gap-1">
                          <div class="w-8 h-full bg-white/5 animate-pulse"></div>
                          <div class="w-8 h-full bg-white/5 animate-pulse delay-75"></div>
                          <div class="w-8 h-full bg-white/5 animate-pulse delay-150"></div>
                        </div>
                      </div>
                      <!-- Actual filmstrip thumbnails -->
                      <div
                        v-for="(thumb, idx) in getFilmstripThumbnails(source)"
                        :key="idx"
                        class="h-full flex-shrink-0 bg-cover bg-center border-r border-black/30"
                        :style="{
                          width: `${thumb.width}px`,
                          backgroundImage: source.source_thumbnail ? `url(${source.source_thumbnail})` : 'none',
                          backgroundPosition: `${thumb.bgPosition}% center`,
                        }"
                      ></div>
                    </div>

                    <!-- Remaining duration overlay -->
                    <div
                      class="absolute top-0 bottom-0 right-0 bg-white/6 pointer-events-none"
                      :style="{ left: `${((source.end_time - source.start_time) / (clipEnd - clipStart)) * 100}%` }"
                    ></div>

                    <!-- Waveform canvas overlay (hidden if audio has been extracted) -->
                    <canvas
                      v-if="!(source as any).audio_extracted"
                      :ref="(el) => setSourceWaveformCanvasRef(el, source.id)"
                      class="absolute inset-0 w-full h-full pointer-events-none opacity-60"
                      style="mix-blend-mode: screen; z-index: 5"
                    ></canvas>

                    <!-- Source label (CapCut style - cyan text at top left) -->
                    <div
                      class="absolute top-0 left-0 right-0 z-10 flex items-start justify-start pointer-events-none px-2 py-1"
                    >
                      <span class="text-[11px] text-cyan-400 font-medium truncate">
                        {{ source.source_name || 'Untitled' }} {{ formatTime(source.end_time - source.start_time) }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </template>

            <!-- Single Video Track (Clip Mode) -->
            <template v-else>
              <div class="flex items-center h-[72px] relative border-b border-white/[0.04]">
                <div
                  class="track-label w-[120px] h-full pl-3 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06] border-l-2 border-l-violet-500"
                >
                  <!-- Track type icon and label -->
                  <div class="flex items-center gap-2 mb-1.5">
                    <div class="w-5 h-5 rounded bg-violet-500/20 flex items-center justify-center">
                      <Film :size="11" class="text-violet-400" />
                    </div>
                    <span class="font-medium text-white/70">Video</span>
                  </div>
                  <!-- Track controls row -->
                  <div class="flex items-center gap-0.5 text-white/40">
                    <button
                      @click.stop="toggleVideoTrackState('isLocked')"
                      class="p-1 rounded hover:bg-white/10 transition-colors"
                      :title="videoTrackState.isLocked ? 'Unlock' : 'Lock'"
                      :class="{ 'text-violet-400 bg-violet-500/15': videoTrackState.isLocked }"
                    >
                      <Lock v-if="videoTrackState.isLocked" :size="12" />
                      <Unlock v-else :size="12" />
                    </button>
                    <button
                      @click.stop="toggleVideoTrackState('isHidden')"
                      class="p-1 rounded hover:bg-white/10 transition-colors"
                      :title="videoTrackState.isHidden ? 'Show' : 'Hide'"
                      :class="{ 'text-violet-400 bg-violet-500/15': videoTrackState.isHidden }"
                    >
                      <EyeOff v-if="videoTrackState.isHidden" :size="12" />
                      <Eye v-else :size="12" />
                    </button>
                    <button
                      @click.stop="toggleVideoTrackState('isMuted')"
                      class="p-1 rounded hover:bg-white/10 transition-colors"
                      :title="videoTrackState.isMuted ? 'Unmute' : 'Mute'"
                      :class="{ 'text-violet-400 bg-violet-500/15': videoTrackState.isMuted }"
                    >
                      <VolumeX v-if="videoTrackState.isMuted" :size="12" />
                      <Volume2 v-else :size="12" />
                    </button>
                  </div>
                </div>
                <div ref="videoTrackContentRef" class="flex-1 h-full relative z-[10]" @click="onTrackContentClick">
                  <!-- Background -->
                  <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>

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
                      @contextmenu.prevent="!isCutToolActive && onSegmentContextMenu($event, segmentLayout.segment)"
                    >
                      <div class="absolute inset-0 bg-black flex overflow-hidden">
                        <div class="absolute inset-0 bg-gradient-to-r from-violet-900/20 to-indigo-900/10"></div>
                        <div class="absolute inset-0 bg-[#161618]"></div>
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
              v-for="(track, trackIndex) in audioTracks"
              :key="track.id"
              class="flex items-center relative transition-all duration-200 border-b border-white/[0.04]"
              :class="{
                'bg-emerald-500/10 ring-2 ring-emerald-500/40 ring-inset':
                  isDragging && dragInfo?.type === 'audio' && dragInfo?.targetTrackOrder === track.trackOrder,
                'h-6': track.isHidden,
                'h-12': !track.isHidden,
                'opacity-50': track.isHidden,
                'opacity-40': !track.isHidden && (track.isMuted || (hasAnySoloedAudioTrack && !track.isSolo)),
              }"
            >
              <div
                class="track-label w-[120px] h-full pl-3 pr-2 flex flex-col justify-center text-[11px] sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06] border-l-2 border-l-emerald-500"
              >
                <!-- Hidden view: single row with icon, name, and show button -->
                <div v-if="track.isHidden" class="flex items-center gap-1.5">
                  <div class="w-4 h-4 rounded bg-emerald-500/20 flex items-center justify-center flex-shrink-0">
                    <Music :size="9" class="text-emerald-400" />
                  </div>
                  <span class="font-medium text-white/60 truncate text-[9px] flex-1 min-w-0">{{ track.name }}</span>
                  <button
                    @click.stop="emit('toggleAudioHidden', track.id)"
                    class="p-0.5 rounded hover:bg-white/10 transition-colors text-emerald-400 bg-emerald-500/15 flex-shrink-0"
                    title="Show"
                  >
                    <EyeOff :size="10" />
                  </button>
                </div>
                <!-- Normal view: full controls -->
                <template v-else>
                  <!-- Track type icon and label -->
                  <div class="flex items-center gap-2 mb-1">
                    <div class="w-5 h-5 rounded bg-emerald-500/20 flex items-center justify-center">
                      <Music :size="11" class="text-emerald-400" />
                    </div>
                    <div class="track-label-text-container min-w-0 flex-1 overflow-hidden" :title="track.name">
                      <span class="track-label-text font-medium text-white/60 text-[10px] whitespace-nowrap">
                        <span>{{ track.name }}</span>
                        <span class="track-label-text-duplicate" aria-hidden="true">{{ track.name }}</span>
                      </span>
                    </div>
                  </div>
                  <!-- Track controls row -->
                  <div class="flex items-center gap-0.5 text-white/40">
                    <!-- Drag handle for track reordering -->
                    <div
                      class="p-0.5 cursor-grab hover:text-white active:cursor-grabbing"
                      title="Drag to reorder track"
                      @mousedown="(e) => onTrackReorderStart(e, 'audio', track.id, track.trackOrder ?? trackIndex)"
                    >
                      <GripVertical :size="11" />
                    </div>
                    <button
                      @click.stop="emit('toggleAudioLock', track.id)"
                      class="p-0.5 rounded hover:bg-white/10 transition-colors"
                      :title="track.isLocked ? 'Unlock' : 'Lock'"
                      :class="{ 'text-emerald-400 bg-emerald-500/15': track.isLocked }"
                    >
                      <Lock v-if="track.isLocked" :size="11" />
                      <Unlock v-else :size="11" />
                    </button>
                    <button
                      @click.stop="emit('toggleAudioHidden', track.id)"
                      class="p-0.5 rounded hover:bg-white/10 transition-colors"
                      :title="track.isHidden ? 'Show' : 'Hide'"
                      :class="{ 'text-emerald-400 bg-emerald-500/15': track.isHidden }"
                    >
                      <EyeOff v-if="track.isHidden" :size="11" />
                      <Eye v-else :size="11" />
                    </button>
                    <button
                      @click.stop="emit('toggleAudioMute', track.id)"
                      class="p-0.5 rounded hover:bg-white/10 transition-colors"
                      :title="track.isMuted ? 'Unmute' : 'Mute'"
                      :class="{ 'text-emerald-400 bg-emerald-500/15': track.isMuted }"
                    >
                      <VolumeX v-if="track.isMuted" :size="11" />
                      <Volume2 v-else :size="11" />
                    </button>
                    <button
                      @click.stop="emit('toggleAudioSolo', track.id)"
                      class="p-0.5 rounded hover:bg-white/10 transition-colors"
                      :title="track.isSolo ? 'Unsolo' : 'Solo'"
                      :class="{ 'text-amber-400 bg-amber-500/15': track.isSolo }"
                    >
                      <Headphones :size="11" />
                    </button>
                  </div>
                </template>
              </div>
              <div
                :ref="(el) => setSegmentRef(el, 'audio', track.id)"
                class="flex-1 h-full relative z-[10]"
                @click="onTrackContentClick"
              >
                <div class="absolute inset-0 bg-[#111111] cursor-pointer"></div>

                <!-- Hidden state: show simplified bar -->
                <div v-if="track.isHidden" class="absolute inset-x-0 top-1 bottom-1 pointer-events-none">
                  <div
                    class="absolute top-1/2 -translate-y-1/2 h-1 rounded-full bg-emerald-500/15"
                    :style="{
                      left: `${(track.startTime / duration) * 100}%`,
                      width: `${((track.endTime - track.startTime) / duration) * 100}%`,
                    }"
                  ></div>
                </div>

                <!-- Render audio track as visual segments that split at video segment boundaries -->
                <template
                  v-if="!track.isHidden"
                  v-for="(visualSeg, segIdx) in getAudioVisualSegments(track)"
                  :key="`${track.id}-vis-${segIdx}`"
                >
                  <!-- Audio visual segment -->
                  <div
                    role="button"
                    tabindex="0"
                    :aria-label="`Audio track: ${track.name}, duration ${formatTime(track.endTime - track.startTime)}, starts at ${formatTime(track.startTime)}`"
                    :aria-selected="selectedItemKey === `audio_${track.id}`"
                    class="clip-segment absolute top-1 bottom-1 rounded-md overflow-hidden group cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-black"
                    :class="getSegmentClasses('audio', track.id)"
                    :style="getAudioVisualSegmentStyle(track, visualSeg)"
                    @mousedown="(e) => onSegmentMouseDown(e, 'audio', track.id, track)"
                    @click.stop="selectItem('audio', track.id)"
                    @keydown.enter="selectItem('audio', track.id)"
                    @keydown.delete="deleteSelectedItem"
                    @keydown.space.prevent="selectItem('audio', track.id)"
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

                    <!-- Fade In overlay and handle (CapCut style - bottom corner triangle) -->
                    <div
                      v-if="visualSeg.isFirst && track.fadeIn > 0"
                      class="absolute top-0 bottom-0 left-0 pointer-events-none z-15"
                      :style="{ width: `${(track.fadeIn / (track.endTime - track.startTime)) * 100}%` }"
                    >
                      <!-- Diagonal fade line from bottom-left to top of fade end -->
                      <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <polygon points="0,100% 100%,0 100%,100%" fill="rgba(0,0,0,0.5)" />
                        <line x1="0" y1="100%" x2="100%" y2="0" stroke="rgba(16,185,129,0.8)" stroke-width="2" />
                      </svg>
                    </div>
                    <!-- Fade In corner handle (bottom-left, drag right to increase) -->
                    <div
                      v-if="visualSeg.isFirst"
                      class="fade-handle absolute bottom-0 left-0 w-4 h-4 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-25"
                      :style="{ left: `calc(${(track.fadeIn / (track.endTime - track.startTime)) * 100}% - 8px)` }"
                      @mousedown.stop="(e) => onFadeHandleMouseDown(e, track.id, 'fadeIn', track)"
                      title="Drag to adjust fade in"
                    >
                      <!-- Triangle handle pointing right -->
                      <div
                        class="w-full h-full bg-emerald-500 rounded-sm shadow-lg shadow-emerald-500/50 flex items-center justify-center"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                          <polygon points="2,1 6,4 2,7" />
                        </svg>
                      </div>
                    </div>

                    <!-- Fade Out overlay and handle (CapCut style - bottom corner triangle) -->
                    <div
                      v-if="visualSeg.isLast && track.fadeOut > 0"
                      class="absolute top-0 bottom-0 right-0 pointer-events-none z-15"
                      :style="{ width: `${(track.fadeOut / (track.endTime - track.startTime)) * 100}%` }"
                    >
                      <!-- Diagonal fade line from top of fade start to bottom-right -->
                      <svg class="absolute inset-0 w-full h-full" preserveAspectRatio="none">
                        <polygon points="0,0 0,100% 100%,100%" fill="rgba(0,0,0,0.5)" />
                        <line x1="0" y1="0" x2="100%" y2="100%" stroke="rgba(16,185,129,0.8)" stroke-width="2" />
                      </svg>
                    </div>
                    <!-- Fade Out corner handle (bottom-right, drag left to increase) -->
                    <div
                      v-if="visualSeg.isLast"
                      class="fade-handle absolute bottom-0 right-0 w-4 h-4 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity z-25"
                      :style="{ right: `calc(${(track.fadeOut / (track.endTime - track.startTime)) * 100}% - 8px)` }"
                      @mousedown.stop="(e) => onFadeHandleMouseDown(e, track.id, 'fadeOut', track)"
                      title="Drag to adjust fade out"
                    >
                      <!-- Triangle handle pointing left -->
                      <div
                        class="w-full h-full bg-emerald-500 rounded-sm shadow-lg shadow-emerald-500/50 flex items-center justify-center"
                      >
                        <svg width="8" height="8" viewBox="0 0 8 8" fill="white">
                          <polygon points="6,1 2,4 6,7" />
                        </svg>
                      </div>
                    </div>
                  </div>
                </template>
              </div>
            </div>

            <!-- Placeholder tracks below -->
            <div
              v-for="n in PLACEHOLDER_BOTTOM_COUNT"
              :key="'placeholder-bottom-' + n"
              class="flex items-center h-8 relative"
            >
              <div
                class="track-label w-[120px] h-full sticky left-0 z-[70] bg-[#0e0e10] flex-shrink-0 border-r border-white/[0.06]"
              ></div>
              <div class="flex-1 h-full relative z-[10] bg-[#111111]"></div>
            </div>

            <!-- Playhead Line (CapCut style - triangular head with gradient line) -->
            <div
              v-if="totalDuration > 0"
              class="absolute top-0 bottom-0 z-[75] cursor-ew-resize group playhead-line flex flex-col items-center"
              :class="{
                'cursor-grabbing': isDraggingPlayhead,
                'playhead-dragging': isDraggingPlayhead,
                'playhead-playing': props.isPlaying && !isDraggingPlayhead,
              }"
              :style="{
                '--playhead-position': effectivePlayheadPosition,
                width: '16px',
                marginLeft: '-8px',
              }"
              @mousedown="onPlayheadMouseDown"
              @wheel="onRulerWheel"
            >
              <!-- Triangular head (CapCut signature style) -->
              <div class="relative flex-shrink-0 playhead-child flex justify-center" style="width: 16px">
                <svg width="14" height="10" viewBox="0 0 14 10">
                  <polygon points="7,10 0,0 14,0" class="fill-amber-500 group-hover:fill-amber-400 transition-colors" />
                </svg>
              </div>
              <!-- The line (gradient from amber to orange) -->
              <div
                class="flex-1 playhead-line-inner playhead-child"
                style="
                  width: 1px;
                  background: linear-gradient(to bottom, rgb(245, 158, 11), rgb(249, 115, 22));
                  box-shadow:
                    0 0 8px rgba(245, 158, 11, 0.5),
                    0 0 4px rgba(249, 115, 22, 0.3);
                "
              ></div>
              <!-- Time tooltip on hover -->
              <div
                class="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity duration-150 pointer-events-none"
              >
                <div
                  class="bg-black/90 text-amber-400 text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded whitespace-nowrap border border-amber-500/30"
                >
                  {{ formatTime(currentTime) }}
                </div>
              </div>
            </div>

            <!-- Snap Indicator Line (shows when segment edge is snapping to another edge) -->
            <!-- Color indicates which track type the snap target is from (cross-track snapping) -->
            <div
              v-if="snapIndicatorPosition !== null"
              class="snap-indicator-line absolute top-0 bottom-0 z-[55] pointer-events-none"
              :style="{
                '--snap-position': snapIndicatorPosition,
              }"
            >
              <div class="absolute inset-0 w-0.5 shadow-lg" :class="snapIndicatorColorClass"></div>
            </div>

            <!-- Trim Preview Tooltip - shows time during resize -->
            <div
              v-if="trimPreviewInfo"
              class="absolute z-[70] pointer-events-none"
              :style="{
                left: `${trimPreviewInfo.leftPercent}%`,
                top: '-28px',
                transform: 'translateX(-50%)',
              }"
            >
              <div
                class="bg-black/90 text-white text-xs px-2 py-1 rounded shadow-lg border border-green-500/50 whitespace-nowrap"
              >
                <span class="text-green-400 font-mono">{{ trimPreviewInfo.formattedTime }}</span>
                <span class="text-white/60 ml-1 text-[10px]">
                  {{ trimPreviewInfo.handle === 'left' ? 'IN' : 'OUT' }}
                </span>
              </div>
              <!-- Arrow pointing down -->
              <div
                class="absolute left-1/2 -translate-x-1/2 -bottom-1 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-green-500/50"
              ></div>
            </div>
          </div>
          <!-- end contentWrapper -->
        </div>
        <!-- end horizontal scroller -->
      </div>
      <!-- end scroll container -->
    </div>
    <!-- end inner container -->

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
        class="fixed z-[9999] bg-[#161618] border border-white/10 rounded-lg shadow-xl py-1 min-w-[220px]"
        :style="{ left: `${sourceContextMenu.x}px`, top: `${sourceContextMenu.y}px` }"
        @click.stop
      >
        <!-- Recent Actions Section -->
        <template v-if="recentActions.length > 0">
          <div class="px-3 py-1 text-[10px] text-white/40 uppercase tracking-wider">Recent</div>
          <button
            v-for="action in recentActions.slice(0, 3)"
            :key="action.id"
            class="w-full px-3 py-1.5 text-left text-sm text-white/70 hover:bg-white/10 flex items-center gap-2"
            @click="executeRecentAction(action.id)"
          >
            <span class="text-white/50">↺</span>
            <span>{{ action.label }}</span>
          </button>
          <div class="h-px bg-white/10 my-1"></div>
        </template>
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="extractAudioFromSource"
          :disabled="isExtractingAudio"
        >
          <span class="flex items-center gap-2">
            <Music :size="14" />
            <span>{{ isExtractingAudio ? 'Extracting...' : 'Extract Audio' }}</span>
          </span>
        </button>
        <div class="h-px bg-white/10 my-1"></div>
        <!-- Edit Operations with Shortcuts -->
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="
            () => {
              closeSourceContextMenu();
              copySelectedItems();
            }
          "
        >
          <span class="flex items-center gap-2">
            <span>Copy</span>
          </span>
          <span class="text-white/40 text-xs">Ctrl+C</span>
        </button>
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="
            () => {
              closeSourceContextMenu();
              duplicateSelectedItems();
            }
          "
        >
          <span class="flex items-center gap-2">
            <span>Duplicate</span>
          </span>
          <span class="text-white/40 text-xs">Ctrl+D</span>
        </button>
        <div class="h-px bg-white/10 my-1"></div>
        <!-- J/L Cut Options -->
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="applyJCut"
          title="Audio from next clip starts before video"
        >
          <span class="flex items-center gap-2">
            <ArrowLeftToLine :size="14" />
            <span>J-Cut (Audio Lead)</span>
          </span>
        </button>
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="applyLCut"
          title="Audio continues into next clip's video"
        >
          <span class="flex items-center gap-2">
            <ArrowRightToLine :size="14" />
            <span>L-Cut (Audio Extend)</span>
          </span>
        </button>
        <button
          v-if="hasAudioOffset(sourceContextMenu.source)"
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="resetAudioTrim"
        >
          <span class="flex items-center gap-2">
            <RotateCcw :size="14" />
            <span>Reset Audio Sync</span>
          </span>
        </button>
        <div class="h-px bg-white/10 my-1"></div>
        <!-- Freeze Frame Option -->
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="addFreezeFrame"
          title="Create a still image from current playhead position"
        >
          <span class="flex items-center gap-2">
            <Film :size="14" />
            <span>Add Freeze Frame</span>
          </span>
        </button>
        <!-- Split/Cut Option -->
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          @click="
            () => {
              closeSourceContextMenu();
              performCutAtPlayhead();
            }
          "
        >
          <span class="flex items-center gap-2">
            <Scissors :size="14" />
            <span>Split at Playhead</span>
          </span>
          <span class="text-white/40 text-xs">X</span>
        </button>
        <div class="h-px bg-white/10 my-1"></div>
        <!-- Speed Ramping Submenu -->
        <div class="relative group/speed">
          <button
            class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center justify-between"
          >
            <span class="flex items-center gap-2">
              <Gauge :size="14" />
              <span>Speed</span>
            </span>
            <span class="text-white/40 text-xs">{{ getSourceSpeed(sourceContextMenu.source) }}x</span>
          </button>
          <!-- Speed submenu -->
          <div
            class="absolute left-full top-0 ml-1 bg-[#161618] border border-white/10 rounded-lg shadow-xl py-1 min-w-[140px] hidden group-hover/speed:block max-h-[300px] overflow-y-auto"
          >
            <!-- Reverse speeds -->
            <div class="px-2 py-1 text-[10px] text-white/40 uppercase tracking-wider">Reverse</div>
            <button
              v-for="speed in [-4, -2, -1, -0.5]"
              :key="'rev-' + speed"
              class="w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 flex items-center justify-between"
              :class="getSourceSpeed(sourceContextMenu.source) === speed ? 'text-orange-400' : 'text-white/80'"
              @click="setSourceSpeed(speed)"
            >
              <span>{{ speed }}x</span>
              <span v-if="getSourceSpeed(sourceContextMenu.source) === speed" class="text-orange-400">✓</span>
            </button>
            <div class="h-px bg-white/10 my-1"></div>
            <!-- Forward speeds -->
            <div class="px-2 py-1 text-[10px] text-white/40 uppercase tracking-wider">Forward</div>
            <button
              v-for="speed in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 4]"
              :key="'fwd-' + speed"
              class="w-full px-3 py-1.5 text-left text-sm hover:bg-white/10 flex items-center justify-between"
              :class="getSourceSpeed(sourceContextMenu.source) === speed ? 'text-blue-400' : 'text-white/80'"
              @click="setSourceSpeed(speed)"
            >
              <span>{{ speed }}x</span>
              <span v-if="getSourceSpeed(sourceContextMenu.source) === speed" class="text-blue-400">✓</span>
            </button>
            <div class="h-px bg-white/10 my-1"></div>
            <!-- Speed Curve Editor -->
            <button
              class="w-full px-3 py-1.5 text-left text-sm text-orange-400 hover:bg-white/10 flex items-center gap-2"
              @click="openSpeedCurveEditor"
            >
              <TrendingUp :size="12" />
              <span>Speed Curve Editor...</span>
            </button>
          </div>
        </div>
        <div class="h-px bg-white/10 my-1"></div>
        <button
          class="w-full px-3 py-2 text-left text-sm text-red-400 hover:bg-white/10 flex items-center justify-between"
          @click="deleteSourceFromContextMenu"
        >
          <span class="flex items-center gap-2">
            <X :size="14" />
            <span>Delete</span>
          </span>
          <span class="text-white/40 text-xs">Del</span>
        </button>
      </div>

      <!-- Segment Context Menu (Clip Mode) -->
      <div
        v-if="segmentContextMenu.visible"
        class="fixed z-[9999] bg-[#161618] border border-white/10 rounded-lg shadow-xl py-1 min-w-[180px]"
        :style="{ left: `${segmentContextMenu.x}px`, top: `${segmentContextMenu.y}px` }"
        @click.stop
      >
        <button
          class="w-full px-3 py-2 text-left text-sm text-white/80 hover:bg-white/10 flex items-center gap-2"
          @click="extractAudioFromSegment"
          :disabled="isExtractingAudio || !props.videoPath"
        >
          <Music :size="14" />
          <span>{{ isExtractingAudio ? 'Extracting...' : 'Extract Audio' }}</span>
        </button>
      </div>
    </Teleport>

    <!-- Click outside to close context menu -->
    <div
      v-if="sourceContextMenu.visible || segmentContextMenu.visible"
      class="fixed inset-0 z-[9998]"
      @click="
        () => {
          closeSourceContextMenu();
          closeSegmentContextMenu();
        }
      "
      @contextmenu.prevent="
        () => {
          closeSourceContextMenu();
          closeSegmentContextMenu();
        }
      "
    ></div>
  </div>
  <!-- end outer bg container -->
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
    MousePointer2,
    MoveHorizontal,
    ArrowLeftRight,
    Columns,
    BoxSelect,
    ArrowLeftToLine,
    ArrowRightToLine,
    RotateCcw,
    ChevronDown,
    ChevronRight,
    Gauge,
    Magnet,
    GripVertical,
    TrendingUp,
    Headphones,
  } from 'lucide-vue-next';
  import { useTimelineTools, type TimelineTool } from '@/composables/useTimelineTools';
  import { invoke, convertFileSrc } from '@tauri-apps/api/core';
  import { useToast } from '@/composables/useToast';
  import { waveformService, useWaveform, type WaveformPeak, type AudioData } from '@/services/waveformService';
  import {
    renderWaveform,
    renderAudioTrackWaveform,
    WAVEFORM_COLORS,
    createThrottledRenderer,
  } from '@/utils/waveformRenderer';
  import type { Track, Keyframe, ItemType } from '@/types/timeline-model';
  import TimelineHoverLine from '@/components/TimelineHoverLine.vue';
  import KeyframeMarker from './KeyframeMarker.vue';
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
    currentDeltaX?: number; // Current drag delta X (for final position calculation)
    currentDeltaY?: number; // Current drag delta Y (for final position calculation)
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

  interface SegmentLayout {
    segment: TrimSegment;
    startPercent: number;
    widthPercent: number;
    effectiveStartTime: number; // Cumulative time from start of timeline
    effectiveEndTime: number; // Cumulative time at end of this segment
  }

  // Gap percentage between segments (0 = segments are butted up against each other)
  const GAP_PERCENT = 0;
  // Balance placeholder lanes above/below primary video track
  const PLACEHOLDER_TOP_COUNT = 2;
  const PLACEHOLDER_BOTTOM_COUNT = 0; // No empty space at bottom - only show when audio tracks exist

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
      videoPath?: string | null;
      audioGainDb?: number; // dB gain (-20 to +20) to apply to main video waveform visualization
      trackDbValues?: Record<string, number>; // Per-track dB values for audio track waveforms
      isPlaying?: boolean; // Whether video is currently playing (for smooth playhead animation)
      // Video editor mode props
      editorMode?: boolean;
      videoSources?: VideoEditorSource[];
      tracks?: Track[];
      // Undo/Redo props
      canUndo?: boolean;
      canRedo?: boolean;
      // Multi-select props
      selectedSegmentIds?: Set<string>;
      selectedSourceIds?: Set<string>; // For editor mode multi-select
      // Marker props
      markers?: Array<{ id: string; time: number; label?: string; color?: string }>;
      selectedMarkerId?: string | null;
      // Chapter marker props (for export metadata)
      chapterMarkers?: Array<{ id: string; time: number; title: string }>;
      // Beat marker props (auto-detected from audio)
      beatMarkers?: Array<{ id: string; time: number; confidence?: number }>;
      // Region/range props (work areas with start/end)
      regions?: Array<{ id: string; startTime: number; endTime: number; label?: string; color?: string }>;
      // Clip transitions and effects (from EffectsTab)
      clipTransitions?: Array<{ id: string; transitionType: string; positionIndex: number; duration: number }>;
      clipEffects?: Array<{
        id: string;
        effectType: string;
        startTime: number;
        endTime: number;
        intensity: number;
        isEnabled: boolean;
      }>;
      // Video track mute state from parent
      isVideoMuted?: boolean;
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
      selectedSourceIds: () => new Set(),
      markers: () => [],
      selectedMarkerId: null,
      chapterMarkers: () => [],
      beatMarkers: () => [],
      regions: () => [],
      clipTransitions: () => [],
      clipEffects: () => [],
      isVideoMuted: false,
    }
  );

  const { activeTool, setTool, isMoveTool, isRazorTool, isRippleTool, isRollTool, isSlipTool, isSlideTool } =
    useTimelineTools();

  const { loading: toastLoading, success: toastSuccess, error: toastError, removeToast } = useToast();

  function getTimelineCursor() {
    if (isRazorTool.value) return 'text'; // Razor often looks like a I-beam or specialized cursor
    if (isRippleTool.value) return 'col-resize';
    if (isRollTool.value) return 'ew-resize';
    if (isSlipTool.value) return 'move';
    if (isSlideTool.value) return 'copy';
    return 'default';
  }

  const emit = defineEmits<{
    (e: 'seek', time: number): void;
    (e: 'updateTrimSegment', segmentId: string, startTime: number, endTime: number): void;
    (e: 'splitTrimSegment', segmentId: string, cutTime: number): void;
    (e: 'deleteTrimSegment', segmentId: string): void;
    (e: 'undo'): void;
    (e: 'redo'): void;
    (e: 'segmentSelect', segmentId: string, modifiers: { shift: boolean; ctrl: boolean }): void;
    (e: 'sourceSelect', sourceId: string, modifiers: { shift: boolean; ctrl: boolean }): void;
    (e: 'markerClick', markerId: string): void;
    (e: 'chapterMarkerClick', markerId: string): void;
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
    (
      e: 'moveTrack',
      data: {
        type: ItemType;
        id: string;
        originalStartTime: number;
        originalEndTime: number;
        newStartTime: number;
        newEndTime: number;
      }
    ): void;
    (e: 'toggleVideoMute', id: string): void;
    (e: 'toggleVideoLock', id: string): void;
    (e: 'toggleVideoHidden', id: string): void;
    (e: 'toggleAudioMute', id: string): void;
    (e: 'toggleAudioSolo', id: string): void;
    (e: 'toggleAudioLock', id: string): void;
    (e: 'toggleAudioHidden', id: string): void;
    // Track collapse events
    (e: 'toggleTrackCollapse', trackType: 'video' | 'audio' | 'overlay', trackId?: string): void;
    // Video editor mode events
    (e: 'updateSource', sourceId: string, updates: Partial<VideoEditorSource>): void;
    (e: 'deleteSource', sourceId: string): void;
    (e: 'dropSource', data: { source: SourceItem; position: number }): void;
    (e: 'transitionsDetected', transitions: VideoEditorTransition[]): void;
    (e: 'splitSource', sourceId: string, cutTimelinePosition: number, cutSourceTime: number): void;
    (
      e: 'extractedAudio',
      data: {
        sourceId: string;
        filePath: string;
        filename: string;
        duration: number;
        startTime: number;
        endTime: number;
        sourceName: string | null;
      }
    ): void;
    (
      e: 'rippleEdit',
      data: { type: ItemType; id: string; newStartTime: number; newEndTime: number; delta: number }
    ): void;
    (
      e: 'rollEdit',
      data: { type: ItemType; leftItemId: string; rightItemId: string; newRollTime: number; originalRollTime: number }
    ): void;
    (
      e: 'slipEdit',
      data: { type: ItemType; itemId: string; delta: number; originalTrimStart: number; originalTrimEnd: number | null }
    ): void;
    (
      e: 'slideEdit',
      data: {
        type: ItemType;
        itemId: string;
        leftNeighborId: string;
        rightNeighborId: string;
        delta: number;
        originalStartTime: number;
        originalEndTime: number;
      }
    ): void;
    (e: 'updateKeyframeTime', data: { itemId: string; keyframeId: string; time: number; type: ItemType }): void;
    (e: 'keyframe-select', data: { itemId: string; keyframeId: string; type: ItemType }): void;
    // J-K-L playback control events
    (e: 'togglePlayback'): void;
    (e: 'setPlaybackSpeed', speed: number): void;
    // Freeze frame event
    (e: 'freezeFrame', data: { sourceId: string; time: number; duration: number }): void;
    // Copy/paste/duplicate events
    (e: 'copyItems', itemKeys: string[]): void; // Format: "type_id"
    (e: 'pasteItems', position: number): void; // Paste at playhead position
    (e: 'pasteItemsInPlace'): void; // Paste at original position
    (e: 'pasteItemsToTrack', data: { position: number; targetTrackType: string; targetTrackId?: string }): void; // Cross-track paste
    (e: 'duplicateItems', itemKeys: string[]): void; // Duplicate selected items
    // Marker events
    (e: 'addMarker', time: number, label?: string, color?: string): void;
    (e: 'deleteMarker', markerId: string): void;
    (e: 'updateMarker', markerId: string, updates: { time?: number; label?: string; color?: string }): void;
    // Chapter marker events (for export metadata)
    (e: 'addChapterMarker', time: number, title: string): void;
    (e: 'updateChapterMarker', markerId: string, updates: { time?: number; title?: string }): void;
    (e: 'deleteChapterMarker', markerId: string): void;
    // Beat marker events (auto-detected from audio)
    (e: 'detectBeatMarkers', audioTrackId?: string): void;
    (e: 'clearBeatMarkers'): void;
    // Region/range events (work area with start/end)
    (e: 'addRegion', startTime: number, endTime: number, label?: string, color?: string): void;
    (
      e: 'updateRegion',
      regionId: string,
      updates: { startTime?: number; endTime?: number; label?: string; color?: string }
    ): void;
    (e: 'deleteRegion', regionId: string): void;
    // In/Out point events (work area)
    (e: 'setInPoint', time: number): void;
    (e: 'setOutPoint', time: number): void;
    (e: 'clearInOutPoints'): void;
    (e: 'goToInPoint'): void;
    (e: 'goToOutPoint'): void;
    // Audio fade events
    (e: 'updateAudioFade', trackId: string, fadeType: 'fadeIn' | 'fadeOut', duration: number): void;
    // Audio ducking events (auto-lower music under speech)
    (
      e: 'enableAudioDucking',
      trackId: string,
      options: { threshold: number; reduction: number; attack: number; release: number }
    ): void;
    (e: 'disableAudioDucking', trackId: string): void;
    // Audio normalization events
    (e: 'normalizeAudio', trackId: string, targetLevel: number): void;
    (e: 'normalizeAllAudio', targetLevel: number): void;
    // Noise reduction events
    (e: 'applyNoiseReduction', trackId: string, options: { strength: number; sensitivity: number }): void;
    // Group/Ungroup events
    (e: 'groupItems', itemKeys: string[]): void; // Group selected items
    (e: 'ungroupItems', groupId: string): void; // Ungroup a group
    // Track reordering events
    (e: 'reorderTrack', trackType: 'audio' | 'overlay', trackId: string, newOrder: number): void;
    // Speed keyframe events
    (e: 'addSpeedKeyframe', sourceId: string, time: number, speed: number): void;
    (
      e: 'updateSpeedKeyframe',
      sourceId: string,
      keyframeId: string,
      updates: { time?: number; speed?: number; easing?: string }
    ): void;
    (e: 'deleteSpeedKeyframe', sourceId: string, keyframeId: string): void;
    // Freeze point events
    (e: 'addFreezePoint', sourceId: string, time: number, duration: number): void;
    (e: 'updateFreezePoint', sourceId: string, freezeId: string, updates: { time?: number; duration?: number }): void;
    (e: 'deleteFreezePoint', sourceId: string, freezeId: string): void;
    // Speed curve editor event
    (e: 'openSpeedCurveEditor', sourceId: string): void;
  }>();

  // Computed: Organized tracks for rendering (Unified Model)
  const unifiedVideoTracks = computed(() => {
    if (!props.tracks) return [];
    // Filter video tracks and sort by orderIndex descending (highest index on top)
    return props.tracks.filter((t) => t.type === 'video').sort((a, b) => b.orderIndex - a.orderIndex);
  });

  const unifiedAudioTracks = computed(() => {
    if (!props.tracks) return [];
    // Filter audio tracks and sort by orderIndex ascending (usually audio tracks stack downwards)
    return props.tracks.filter((t) => t.type === 'audio').sort((a, b) => a.orderIndex - b.orderIndex);
  });

  // Computed: Check if any audio track has solo enabled (for visual dimming of other tracks)
  const hasAnySoloedAudioTrack = computed(() => {
    return props.audioTracks.some((t) => t.isSolo);
  });

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
  // Video source waveform canvas refs for editor mode
  const sourceWaveformCanvasRefs = ref<Map<string, HTMLCanvasElement>>(new Map());
  const sourceWaveformLoading = ref<Set<string>>(new Set());
  // Audio track waveform loading state
  const audioWaveformLoading = ref<Set<string>>(new Set());

  const videoTrackState = reactive({
    isMuted: false,
    isLocked: false,
    isHidden: false,
  });

  // Sync videoTrackState.isMuted with prop from parent
  watch(
    () => props.isVideoMuted,
    (newValue) => {
      videoTrackState.isMuted = newValue;
    },
    { immediate: true }
  );

  function toggleVideoTrackState(prop: keyof typeof videoTrackState) {
    // Emit event to parent for actual functionality (parent will update prop)
    if (prop === 'isMuted') {
      emit('toggleVideoMute', 'main');
      return; // Don't toggle locally - parent will update via prop
    }
    // For non-mute properties, toggle locally
    videoTrackState[prop] = !videoTrackState[prop];
  }

  // Zoom system: 0% = fit-to-width (full video visible), positive % = zoomed in
  // MIN_ZOOM represents the fit-to-width baseline (calculated dynamically)
  const MIN_ZOOM = ref(1.0); // Will be calculated based on viewport width
  const baselineZoom = ref(1.0); // The fit-to-width zoom level (1.0 = 100% of container)
  const zoomLevel = ref(1.0); // Start at baseline (fit-to-width)
  const zoomMenuOpen = ref(false);

  // Calculate dynamic zoom step based on current zoom level
  // Smaller steps for fine control near baseline
  function getZoomStep(): number {
    const relativeZoom = zoomLevel.value / baselineZoom.value;
    if (relativeZoom < 2) return 0.1; // Fine control near baseline
    if (relativeZoom < 5) return 0.25;
    if (relativeZoom < 10) return 0.5;
    if (relativeZoom < 50) return 1;
    if (relativeZoom < 100) return 5;
    return 10;
  }

  function zoomIn() {
    const step = getZoomStep();
    zoomLevel.value = zoomLevel.value + step;
    ticksZoomLevel.value = zoomLevel.value; // Sync immediately for button clicks
    nextTick(updateVisibleTimeRange);
  }

  function zoomOut() {
    const step = getZoomStep();
    zoomLevel.value = Math.max(MIN_ZOOM.value, zoomLevel.value - step);
    ticksZoomLevel.value = zoomLevel.value; // Sync immediately for button clicks
    nextTick(updateVisibleTimeRange);
  }

  // Calculate fit-to-width zoom level (baseline = 0%)
  // This makes the entire video duration visible in the viewport
  function calculateFitToWidthZoom(): number {
    // Default to 1.0 if we can't calculate (will be updated when container is available)
    if (!timelineScrollContainer.value) return 1.0;

    // Get the available width for timeline content
    const containerWidth = timelineScrollContainer.value.clientWidth;
    // Assume we want the full duration to fit in the viewport
    // The zoom level of 1.0 means 100% width, so we return 1.0 as baseline
    // This will be the "0%" zoom level in the UI
    return 1.0;
  }

  // Initialize zoom to fit-to-width on mount
  function initializeZoom() {
    const fitZoom = calculateFitToWidthZoom();
    baselineZoom.value = fitZoom;
    MIN_ZOOM.value = fitZoom;
    zoomLevel.value = fitZoom; // Start at 0% (fit-to-width)
    ticksZoomLevel.value = fitZoom; // Sync ticks zoom level
  }

  // Zoom to fit all content in view
  function zoomToFit() {
    const fitZoom = calculateFitToWidthZoom();
    baselineZoom.value = fitZoom;
    MIN_ZOOM.value = fitZoom;
    zoomLevel.value = fitZoom;
    ticksZoomLevel.value = fitZoom; // Sync immediately

    // Reset scroll to start
    nextTick(() => {
      const scrollContainer = timelineScrollContainer.value;
      if (scrollContainer) {
        scrollContainer.scrollLeft = 0;
      }
      updateVisibleTimeRange();
    });
  }

  // Zoom to focus on selected segment(s)
  function zoomToSelection() {
    if (!selectedItemKey.value) return;

    const [type, id] = selectedItemKey.value.split('_');
    let startTime = 0;
    let endTime = 0;

    // Find the selected item's time range
    if (type === 'source') {
      const source = props.videoSources?.find((s) => s.id === id);
      if (source) {
        startTime = source.start_time;
        endTime = source.end_time;
      }
    } else if (type === 'trim') {
      const segment = props.trimSegments.find((s) => s.id === id);
      if (segment) {
        startTime = segment.startTime;
        endTime = segment.endTime;
      }
    } else if (type === 'audio') {
      const track = props.audioTracks.find((t) => t.id === id);
      if (track) {
        startTime = track.startTime;
        endTime = track.endTime;
      }
    } else if (type === 'text') {
      const overlay = props.textOverlays.find((t) => t.id === id);
      if (overlay) {
        startTime = overlay.startTime;
        endTime = overlay.endTime;
      }
    }

    if (endTime <= startTime) return;

    const duration = endTime - startTime;
    const totalDur = props.editorMode ? props.duration : totalDuration.value;
    if (totalDur <= 0) return;

    // Calculate zoom to show selection with some padding (20% on each side)
    const paddedDuration = duration * 1.4;
    const targetZoom = totalDur / paddedDuration;

    zoomLevel.value = Math.max(MIN_ZOOM.value, targetZoom);
    ticksZoomLevel.value = zoomLevel.value; // Sync immediately

    // Scroll to center the selection
    nextTick(() => {
      const scrollContainer = timelineScrollContainer.value;
      const contentWrapper = contentWrapperRef.value;
      if (!scrollContainer || !contentWrapper) return;

      const contentWidth = contentWrapper.offsetWidth;
      const containerWidth = scrollContainer.clientWidth;
      const selectionCenter = (startTime + endTime) / 2 / totalDur;
      const targetScrollLeft = selectionCenter * contentWidth - containerWidth / 2;

      scrollContainer.scrollLeft = Math.max(0, targetScrollLeft);
      updateVisibleTimeRange();
    });
  }

  // Get zoom display text (0% = fit-to-width, positive % = zoomed in)
  function getZoomDisplayText(): string {
    if (Math.abs(zoomLevel.value - baselineZoom.value) < 0.01) {
      return '0%'; // At baseline (fit-to-width)
    }
    // Calculate zoom percentage relative to baseline
    const zoomPercent = Math.round((zoomLevel.value / baselineZoom.value - 1) * 100);
    return `${zoomPercent}%`;
  }

  // Sync ticksZoomLevel when zoomLevel changes from direct assignments (dropdown buttons)
  // This catches cases where zoomLevel is set directly in the template
  watch(zoomLevel, (newZoom) => {
    // Only sync if not in an active scroll-to-zoom gesture
    // (scroll-to-zoom handles ticksZoomLevel via debouncing in applyPendingZoom)
    if (!isZooming.value && !pendingZoom) {
      ticksZoomLevel.value = newZoom;
    }
  });

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
    currentDeltaX?: number; // Current snap-adjusted delta for final position calculation
  } | null>(null);

  // Source context menu state
  const sourceContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    source: null as VideoEditorSource | null,
  });
  const isExtractingAudio = ref(false);

  // Recent actions tracking for context menu quick access
  interface RecentAction {
    id: string;
    label: string;
    icon?: string;
    timestamp: number;
  }
  const recentActions = ref<RecentAction[]>([]);
  const MAX_RECENT_ACTIONS = 5;

  /**
   * Track a recent action for quick access in context menus
   */
  function trackRecentAction(id: string, label: string, icon?: string) {
    // Remove if already exists
    recentActions.value = recentActions.value.filter((a) => a.id !== id);

    // Add to front
    recentActions.value.unshift({
      id,
      label,
      icon,
      timestamp: Date.now(),
    });

    // Limit to max
    if (recentActions.value.length > MAX_RECENT_ACTIONS) {
      recentActions.value = recentActions.value.slice(0, MAX_RECENT_ACTIONS);
    }
  }

  /**
   * Get recent actions for display in context menu
   */
  function getRecentActions(): RecentAction[] {
    return recentActions.value;
  }

  /**
   * Execute a recent action by its ID
   */
  function executeRecentAction(actionId: string) {
    closeSourceContextMenu();
    closeSegmentContextMenu();

    switch (actionId) {
      case 'copy':
        copySelectedItems();
        break;
      case 'duplicate':
        duplicateSelectedItems();
        break;
      case 'cut':
        performCutAtPlayhead();
        break;
      case 'delete':
        deleteSelectedItem();
        break;
      case 'extract-audio':
        extractAudioFromSource();
        break;
      case 'freeze-frame':
        addFreezeFrame();
        break;
      case 'speed-curve':
        openSpeedCurveEditor();
        break;
      default:
        console.warn('[executeRecentAction] Unknown action:', actionId);
    }
  }

  // Selection state
  const selectedItemKey = ref<string | null>(null);
  const selectedKeyframeId = ref<string | null>(null);

  function selectKeyframe(keyframeId: string, event: MouseEvent, itemId?: string, type?: ItemType) {
    selectedKeyframeId.value = keyframeId;
    if (itemId && type) {
      emit('keyframe-select', { keyframeId, itemId, type });
    }
  }

  // Clear keyframe selection when item selection changes if the new item is null
  watch(selectedItemKey, (newValue) => {
    if (!newValue) {
      selectedKeyframeId.value = null;
    }
  });

  // Keyframe Drag State
  const keyframeDragState = ref<{
    id: string;
    itemId: string; // The item containing the keyframe
    itemType: ItemType;
    startX: number;
    originalTime: number;
    itemDuration: number;
  } | null>(null);

  function startKeyframeDrag(
    e: MouseEvent,
    keyframe: Keyframe,
    itemId: string,
    itemType: ItemType,
    itemDuration: number
  ) {
    e.preventDefault();
    e.stopPropagation();

    keyframeDragState.value = {
      id: keyframe.id,
      itemId,
      itemType,
      startX: e.clientX,
      originalTime: keyframe.time,
      itemDuration,
    };

    // Select the keyframe on drag start
    selectKeyframe(keyframe.id, e);

    document.addEventListener('mousemove', onKeyframeDragMove);
    document.addEventListener('mouseup', onKeyframeDragEnd);
  }

  function onKeyframeDragMove(e: MouseEvent) {
    if (!keyframeDragState.value) return;

    const { startX, originalTime, itemDuration, itemId, id, itemType } = keyframeDragState.value;
    const deltaX = e.clientX - startX;

    // Calculate track width for pixel-to-time conversion
    const trackContentWidth = getTrackContentWidth();

    // Calculate delta time based on global timeline scale
    const deltaTime = (deltaX / trackContentWidth) * props.duration;

    let newTime = originalTime + deltaTime;

    // Clamp to item duration (0 to itemDuration)
    newTime = Math.max(0, Math.min(itemDuration, newTime));

    // Emit update event
    emit('updateKeyframeTime', { itemId, keyframeId: id, time: newTime, type: itemType });
  }

  function onKeyframeDragEnd() {
    keyframeDragState.value = null;
    document.removeEventListener('mousemove', onKeyframeDragMove);
    document.removeEventListener('mouseup', onKeyframeDragEnd);
  }

  // Drag state
  const isDragging = ref(false);
  const dragInfo = ref<DragInfo | null>(null);

  // Resize state
  const isResizing = ref(false);
  const resizeInfo = ref<ResizeInfo | null>(null);

  // Preview state for optimistic updates (local-only during drag/resize)
  const dragPreview = ref<{
    type: ItemType;
    id: string;
    startTime: number;
    endTime: number;
    trimStart?: number;
    trimEnd?: number;
  } | null>(null);

  // Ghost element for drag visualization - uses direct DOM manipulation for zero-lag dragging
  // This completely bypasses Vue's reactivity system during drag for true 60fps performance
  const dragGhostRef = ref<HTMLDivElement | null>(null);
  const dragGhostState = ref<{
    visible: boolean;
    type: ItemType;
    id: string;
    initialLeft: number;
    initialTop: number;
    width: number;
    height: number;
    label: string;
    color: string;
  } | null>(null);

  // Ripple Edit State
  const rippleState = ref<{
    type: ItemType;
    id: string;
    delta: number;
    originalEdgeTime: number;
  } | null>(null);

  // Track reordering state
  const trackReorderState = ref<{
    trackType: 'audio' | 'overlay';
    trackId: string;
    originalOrder: number;
    startY: number;
    lastEmittedOrder: number;
    maxOrder: number;
  } | null>(null);

  // Trim preview state - shows frame time during resize
  const trimPreviewInfo = computed(() => {
    if (!isResizing.value || !resizeInfo.value || !dragPreview.value) return null;

    const handle = resizeInfo.value.handle;
    const time = handle === 'left' ? dragPreview.value.startTime : dragPreview.value.endTime;

    // Calculate position for the preview tooltip
    const percent = (time / totalDuration.value) * 100;

    return {
      time,
      formattedTime: formatTime(time),
      handle,
      leftPercent: percent,
      type: resizeInfo.value.type,
    };
  });

  // Computed: IDs of segments that will be affected by ripple edit
  const rippleAffectedIds = computed(() => {
    if (!rippleState.value) return new Set<string>();

    const affected = new Set<string>();
    const edgeTime = rippleState.value.originalEdgeTime;

    if (props.editorMode) {
      // Editor mode: check video sources
      for (const source of props.videoSources) {
        if (source.id !== rippleState.value.id && source.start_time >= edgeTime - 0.001) {
          affected.add(source.id);
        }
      }
    } else {
      // Clip mode: check trim segments
      for (const segment of sortedTrimSegments.value) {
        if (segment.id !== rippleState.value.id && segment.startTime >= edgeTime - 0.001) {
          affected.add(segment.id);
        }
      }
    }

    return affected;
  });

  // Computed: IDs of segments that are overlapping/colliding with other segments
  const collidingSegmentIds = computed(() => {
    const colliding = new Set<string>();

    if (props.editorMode) {
      // Editor mode: check video sources for overlaps
      const sources = props.videoSources;
      for (let i = 0; i < sources.length; i++) {
        for (let j = i + 1; j < sources.length; j++) {
          const a = sources[i];
          const b = sources[j];
          // Check if segments overlap (not just touch)
          if (a.start_time < b.end_time && a.end_time > b.start_time) {
            colliding.add(a.id);
            colliding.add(b.id);
          }
        }
      }
    } else {
      // Clip mode: check trim segments for overlaps
      const segments = sortedTrimSegments.value;
      for (let i = 0; i < segments.length; i++) {
        for (let j = i + 1; j < segments.length; j++) {
          const a = segments[i];
          const b = segments[j];
          // Check if segments overlap (not just touch)
          if (a.startTime < b.endTime && a.endTime > b.startTime) {
            colliding.add(a.id);
            colliding.add(b.id);
          }
        }
      }
    }

    // Also check audio tracks for overlaps within the same track order
    const audioByOrder = new Map<number, typeof props.audioTracks>();
    for (const track of props.audioTracks) {
      const order = track.trackOrder ?? 0;
      if (!audioByOrder.has(order)) {
        audioByOrder.set(order, []);
      }
      audioByOrder.get(order)!.push(track);
    }

    for (const [, tracks] of audioByOrder) {
      for (let i = 0; i < tracks.length; i++) {
        for (let j = i + 1; j < tracks.length; j++) {
          const a = tracks[i];
          const b = tracks[j];
          if (a.startTime < b.endTime && a.endTime > b.startTime) {
            colliding.add(a.id);
            colliding.add(b.id);
          }
        }
      }
    }

    return colliding;
  });

  // Roll Edit State
  const rollState = ref<{
    type: ItemType;
    leftItemId: string;
    rightItemId: string;
    originalRollTime: number;
    newRollTime: number;
    activeHandle: 'left' | 'right';
  } | null>(null);

  // Slip Edit State
  const slipState = ref<{
    type: ItemType;
    id: string;
    delta: number;
    originalTrimStart: number;
    originalTrimEnd: number | null;
  } | null>(null);

  // Slide Edit State
  const slideState = ref<{
    type: ItemType;
    id: string;
    leftNeighborId: string;
    rightNeighborId: string;
    delta: number;
    originalStartTime: number;
    originalEndTime: number;
  } | null>(null);

  // Performance: Debounce utility for reducing re-renders
  function debounce<T extends (...args: any[]) => void>(fn: T, delay: number): T {
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return ((...args: Parameters<T>) => {
      if (timeoutId) clearTimeout(timeoutId);
      timeoutId = setTimeout(() => fn(...args), delay);
    }) as T;
  }

  // Performance: Throttle utility for limiting function calls
  function throttle<T extends (...args: any[]) => void>(fn: T, limit: number): T {
    let lastCall = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    return ((...args: Parameters<T>) => {
      const now = Date.now();
      const remaining = limit - (now - lastCall);
      if (remaining <= 0) {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = null;
        }
        lastCall = now;
        fn(...args);
      } else if (!timeoutId) {
        timeoutId = setTimeout(() => {
          lastCall = Date.now();
          timeoutId = null;
          fn(...args);
        }, remaining);
      }
    }) as T;
  }

  // Debounced waveform rendering (16ms = ~60fps)
  const debouncedRenderWaveforms = debounce(() => {
    renderAllAudioWaveforms();
    renderAllSourceWaveforms();
  }, 16);

  // Throttled seek during drag (limit to 60fps)
  const throttledSeek = throttle((time: number) => {
    emit('seek', time);
  }, 16);

  // ============================================
  // PERFORMANCE: Interaction state flags
  // ============================================

  // Track when user is actively zooming (to skip expensive renders)
  const isZooming = ref(false);
  let zoomEndTimeout: ReturnType<typeof setTimeout> | null = null;

  // Debounced zoom level for ruler ticks - updates after zoom gesture settles
  // This prevents expensive tick recalculation on every scroll frame
  const ticksZoomLevel = ref(1.0);
  let ticksZoomTimeout: ReturnType<typeof setTimeout> | null = null;

  // Pending zoom state for batching via requestAnimationFrame
  let pendingZoom: {
    newZoom: number;
    logicalPosition: number;
    cursorXInContainer: number;
    scrollContainer: HTMLElement;
  } | null = null;
  let zoomRAFId: number | null = null;

  /**
   * Apply pending zoom changes in a single animation frame
   * This batches multiple zoom events for smoother visual updates
   */
  function applyPendingZoom() {
    if (!pendingZoom) {
      zoomRAFId = null;
      return;
    }

    const { newZoom, logicalPosition, cursorXInContainer, scrollContainer } = pendingZoom;
    pendingZoom = null;
    zoomRAFId = null;

    // Apply the zoom immediately for visual feedback
    zoomLevel.value = newZoom;

    // Debounce the ticks zoom level update (ruler recalculation)
    if (ticksZoomTimeout) {
      clearTimeout(ticksZoomTimeout);
    }
    ticksZoomTimeout = setTimeout(() => {
      ticksZoomLevel.value = newZoom;
      ticksZoomTimeout = null;
    }, 100);

    // Adjust scroll to keep cursor position stable
    nextTick(() => {
      const newContentWidth = scrollContainer.scrollWidth;
      const newContentX = logicalPosition * newContentWidth;
      const newScrollLeft = newContentX - cursorXInContainer;
      scrollContainer.scrollLeft = Math.max(0, newScrollLeft);
      // Update visible time range after scroll adjustment
      updateVisibleTimeRange();
    });
  }

  /**
   * Queue a zoom update to be applied in the next animation frame
   * This batches multiple rapid zoom events (like trackpad pinch) for performance
   */
  function queueZoomUpdate(
    newZoom: number,
    logicalPosition: number,
    cursorXInContainer: number,
    scrollContainer: HTMLElement
  ) {
    // Mark as zooming to suppress waveform renders
    isZooming.value = true;

    // Clear any pending zoom end timeout
    if (zoomEndTimeout) {
      clearTimeout(zoomEndTimeout);
    }

    // Schedule zoom end after user stops zooming (200ms idle for smoother experience)
    zoomEndTimeout = setTimeout(() => {
      isZooming.value = false;
      zoomEndTimeout = null;
      // Sync ticks zoom level when zoom ends
      ticksZoomLevel.value = zoomLevel.value;
      // Update visible time range for virtualized rendering
      updateVisibleTimeRange();
      // Trigger a final waveform render after zoom completes
      debouncedRenderAllWaveforms();
    }, 200);

    // Store the pending zoom (latest values win)
    pendingZoom = { newZoom, logicalPosition, cursorXInContainer, scrollContainer };

    // Schedule the zoom to be applied in the next animation frame
    if (!zoomRAFId) {
      zoomRAFId = requestAnimationFrame(applyPendingZoom);
    }
  }

  // Debounced full waveform rendering (100ms delay for expensive operations)
  const debouncedRenderAllWaveforms = debounce(() => {
    // Don't render if still in an active interaction
    if (isZooming.value || isDragging.value || isResizing.value) return;
    renderAllWaveforms();
    renderAllAudioWaveforms();
    renderAllSourceWaveforms();
  }, 100);

  // Virtual scrolling state - only render visible track portions
  const virtualScrollState = ref({
    visibleStartTime: 0,
    visibleEndTime: 0,
    bufferTime: 5, // Extra seconds to render on each side for smooth scrolling
  });

  /**
   * Calculate which items are visible based on scroll position
   * Returns true if an item overlaps with the visible viewport
   */
  function isItemVisible(startTime: number, endTime: number): boolean {
    const { visibleStartTime, visibleEndTime, bufferTime } = virtualScrollState.value;
    const bufferedStart = visibleStartTime - bufferTime;
    const bufferedEnd = visibleEndTime + bufferTime;

    // Item is visible if it overlaps with the buffered viewport
    return endTime >= bufferedStart && startTime <= bufferedEnd;
  }

  /**
   * Update visible time range based on scroll position
   */
  function updateVisibleTimeRange() {
    if (!timelineScrollContainer.value) return;

    const container = timelineScrollContainer.value;
    const scrollLeft = container.scrollLeft;
    const viewportWidth = container.clientWidth;
    const contentWidth = container.scrollWidth;

    if (contentWidth <= 0) return;

    const totalDur = props.editorMode ? props.duration : totalDuration.value;
    const scrollPercent = scrollLeft / contentWidth;
    const viewportPercent = viewportWidth / contentWidth;

    virtualScrollState.value.visibleStartTime = scrollPercent * totalDur;
    virtualScrollState.value.visibleEndTime = (scrollPercent + viewportPercent) * totalDur;
  }

  /**
   * Handle scroll events on the timeline container
   * Updates visible time range for virtualized tick rendering
   */
  function onTimelineScroll() {
    updateVisibleTimeRange();
  }

  // Screen reader announcements for accessibility
  const screenReaderAnnouncement = ref('');

  /**
   * Announce a message to screen readers using ARIA live region
   */
  function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
    screenReaderAnnouncement.value = '';
    // Use nextTick to ensure the change is detected
    nextTick(() => {
      screenReaderAnnouncement.value = message;
    });
  }

  /**
   * Announce selection changes to screen readers
   */
  function announceSelection(type: string, name: string) {
    announceToScreenReader(`Selected ${type}: ${name}`);
  }

  /**
   * Announce playback state changes
   */
  function announcePlaybackState(isPlaying: boolean) {
    announceToScreenReader(isPlaying ? 'Playback started' : 'Playback paused');
  }

  /**
   * Announce time position changes (throttled)
   */
  const announceTimePosition = throttle((time: number) => {
    announceToScreenReader(`Time: ${formatTime(time)}`, 'polite');
  }, 1000);

  // High contrast mode for accessibility
  const highContrastMode = ref(false);

  /**
   * Toggle high contrast mode for better visibility
   */
  function toggleHighContrastMode() {
    highContrastMode.value = !highContrastMode.value;
    announceToScreenReader(highContrastMode.value ? 'High contrast mode enabled' : 'High contrast mode disabled');
  }

  /**
   * Get high contrast color variant
   */
  function getHighContrastColor(normalColor: string, highContrastColor: string): string {
    return highContrastMode.value ? highContrastColor : normalColor;
  }

  // Audio Fade Handle State
  const fadeHandleState = ref<{
    trackId: string;
    fadeType: 'fadeIn' | 'fadeOut';
    startX: number;
    originalFade: number;
    trackDuration: number;
    trackElement: HTMLElement | null;
  } | null>(null);

  // Playhead drag state
  const isDraggingPlayhead = ref(false);

  // Optimistic playhead position during drag (avoids round-trip lag)
  // This is the time value we're dragging to, updated immediately during drag
  const optimisticDragTime = ref<number | null>(null);

  // Inertial scrolling state for playhead
  const playheadVelocity = ref(0);
  const lastPlayheadDragTime = ref(0);
  const lastPlayheadDragX = ref(0);
  let inertialAnimationId: number | null = null;

  // Frame-accurate scrubbing state
  const frameRate = 30; // Assume 30fps, could be made configurable
  const frameSnapEnabled = ref(true);

  // Audio scrubbing state - play audio preview while dragging playhead
  const audioScrubEnabled = ref(true);
  let scrubAudioContext: AudioContext | null = null;
  let scrubAudioBuffer: AudioBuffer | null = null;
  let scrubSourceNode: AudioBufferSourceNode | null = null;
  let lastScrubTime = 0;
  const SCRUB_SNIPPET_DURATION = 0.08; // Duration of audio snippet to play (80ms)

  // Cut tool state
  const isCutToolActive = ref(false);
  const cutHoverInfo = ref<CutHoverInfo | null>(null);

  // Smooth playhead animation state
  const smoothPlayheadPosition = ref(0);

  // J-K-L playback speed state (industry standard shuttle control)
  // -4 to 4: negative = reverse, 0 = stopped, positive = forward
  const jklPlaybackSpeed = ref(0);

  // Track collapse state (local UI state)
  const collapsedTracks = ref<Set<string>>(new Set()); // Set of "trackType_trackId" keys

  // Track height adjustment state (local UI state)
  const trackHeights = ref<Map<string, number>>(new Map()); // Map of "trackType_trackId" -> height in pixels
  const DEFAULT_VIDEO_TRACK_HEIGHT = 96;
  const DEFAULT_AUDIO_TRACK_HEIGHT = 64;
  const DEFAULT_OVERLAY_TRACK_HEIGHT = 40;
  const MIN_TRACK_HEIGHT = 32;
  const MAX_TRACK_HEIGHT = 200;

  // Track colors state (local UI state)
  const trackColors = ref<Map<string, string>>(new Map()); // Map of "trackType_trackId" -> color hex
  const DEFAULT_TRACK_COLORS = ['#8b5cf6', '#10b981', '#f59e0b', '#ec4899', '#06b6d4', '#f43f5e'];

  /**
   * Get the height for a specific track
   */
  function getTrackHeight(trackType: string, trackId?: string): number {
    const key = trackId ? `${trackType}_${trackId}` : trackType;
    const customHeight = trackHeights.value.get(key);
    if (customHeight) return customHeight;

    // Return default based on track type
    switch (trackType) {
      case 'video':
        return DEFAULT_VIDEO_TRACK_HEIGHT;
      case 'audio':
        return DEFAULT_AUDIO_TRACK_HEIGHT;
      default:
        return DEFAULT_OVERLAY_TRACK_HEIGHT;
    }
  }

  /**
   * Set custom height for a track
   */
  function setTrackHeight(trackType: string, trackId: string | undefined, height: number) {
    const key = trackId ? `${trackType}_${trackId}` : trackType;
    const clampedHeight = Math.max(MIN_TRACK_HEIGHT, Math.min(MAX_TRACK_HEIGHT, height));
    trackHeights.value.set(key, clampedHeight);
  }

  /**
   * Get the color for a specific track
   */
  function getTrackColor(trackType: string, trackId?: string, index: number = 0): string {
    const key = trackId ? `${trackType}_${trackId}` : trackType;
    const customColor = trackColors.value.get(key);
    if (customColor) return customColor;

    // Return default color based on index
    return DEFAULT_TRACK_COLORS[index % DEFAULT_TRACK_COLORS.length];
  }

  /**
   * Set custom color for a track
   */
  function setTrackColor(trackType: string, trackId: string | undefined, color: string) {
    const key = trackId ? `${trackType}_${trackId}` : trackType;
    trackColors.value.set(key, color);
  }

  // Waveform display options
  const waveformDisplayMode = ref<'mono' | 'stereo'>('mono'); // Stereo shows L/R channels
  const waveformVerticalZoom = ref(1.0); // 0.5 to 3.0 for vertical scaling
  const waveformViewMode = ref<'waveform' | 'spectral'>('waveform'); // Spectral view option
  const MIN_WAVEFORM_ZOOM = 0.5;
  const MAX_WAVEFORM_ZOOM = 3.0;

  /**
   * Toggle stereo waveform display
   */
  function toggleStereoWaveform() {
    waveformDisplayMode.value = waveformDisplayMode.value === 'mono' ? 'stereo' : 'mono';
  }

  /**
   * Set waveform vertical zoom level
   */
  function setWaveformVerticalZoom(zoom: number) {
    waveformVerticalZoom.value = Math.max(MIN_WAVEFORM_ZOOM, Math.min(MAX_WAVEFORM_ZOOM, zoom));
  }

  /**
   * Toggle between waveform and spectral view
   */
  function toggleSpectralView() {
    waveformViewMode.value = waveformViewMode.value === 'waveform' ? 'spectral' : 'waveform';
  }

  // Track height resize state
  const isResizingTrackHeight = ref(false);
  const trackHeightResizeInfo = ref<{
    trackType: string;
    trackId?: string;
    startY: number;
    startHeight: number;
  } | null>(null);

  /**
   * Start resizing track height
   */
  function onTrackHeightResizeStart(e: MouseEvent, trackType: string, trackId?: string) {
    e.preventDefault();
    e.stopPropagation();

    isResizingTrackHeight.value = true;
    trackHeightResizeInfo.value = {
      trackType,
      trackId,
      startY: e.clientY,
      startHeight: getTrackHeight(trackType, trackId),
    };

    document.addEventListener('mousemove', onTrackHeightResizeMove);
    document.addEventListener('mouseup', onTrackHeightResizeEnd);
  }

  function onTrackHeightResizeMove(e: MouseEvent) {
    if (!isResizingTrackHeight.value || !trackHeightResizeInfo.value) return;

    const deltaY = e.clientY - trackHeightResizeInfo.value.startY;
    const newHeight = trackHeightResizeInfo.value.startHeight + deltaY;

    setTrackHeight(trackHeightResizeInfo.value.trackType, trackHeightResizeInfo.value.trackId, newHeight);
  }

  function onTrackHeightResizeEnd() {
    isResizingTrackHeight.value = false;
    trackHeightResizeInfo.value = null;
    document.removeEventListener('mousemove', onTrackHeightResizeMove);
    document.removeEventListener('mouseup', onTrackHeightResizeEnd);
  }

  // Marquee selection state
  const marqueeSelection = ref<{
    active: boolean;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
  } | null>(null);

  // Computed marquee rectangle style
  const marqueeStyle = computed(() => {
    if (!marqueeSelection.value || !marqueeSelection.value.active) return null;

    const { startX, startY, currentX, currentY } = marqueeSelection.value;
    const left = Math.min(startX, currentX);
    const top = Math.min(startY, currentY);
    const width = Math.abs(currentX - startX);
    const height = Math.abs(currentY - startY);

    return {
      left: `${left}px`,
      top: `${top}px`,
      width: `${width}px`,
      height: `${height}px`,
    };
  });

  function isTrackCollapsed(trackType: string, trackId?: string): boolean {
    const key = trackId ? `${trackType}_${trackId}` : trackType;
    return collapsedTracks.value.has(key);
  }

  function toggleTrackCollapse(trackType: 'video' | 'audio' | 'overlay', trackId?: string) {
    const key = trackId ? `${trackType}_${trackId}` : trackType;
    if (collapsedTracks.value.has(key)) {
      collapsedTracks.value.delete(key);
    } else {
      collapsedTracks.value.add(key);
    }
    emit('toggleTrackCollapse', trackType, trackId);
  }
  // Hover line state
  const showHoverLine = ref(false);
  const hoverLinePosition = ref(0);
  const timelineBounds = ref({ top: 0, bottom: 0, left: 0 });

  // Track label width constant (matches the w-[120px] class = 120px)
  const TRACK_LABEL_WIDTH = 120;

  // Snap configuration
  const SNAP_THRESHOLD_PX = 5; // Pixels distance to trigger snapping
  const snapEnabled = ref(true);
  const snapMenuOpen = ref(false);
  const snapPreferences = ref({
    playhead: true,
    segmentEdges: true,
    markers: true,
    grid: false,
    magnetic: true, // Magnetic timeline - segments attract to nearby edges with larger threshold
  });

  // Magnetic timeline threshold (larger than regular snap for attraction effect)
  const MAGNETIC_THRESHOLD_PX = 12; // Pixels distance for magnetic attraction

  // Snap state for visual indicator
  const activeSnapTime = ref<number | null>(null); // Time position where snap is occurring
  const activeSnapTrackType = ref<string | null>(null); // Track type for cross-track snap indicator styling

  // Auto-scroll configuration for keeping playhead visible during playback
  // Stepping approach: scroll when playhead reaches threshold, jump to target position
  const AUTO_SCROLL_TRIGGER_PERCENT = 0.85; // Scroll when playhead reaches 85% of visible track area
  const AUTO_SCROLL_TARGET_PERCENT = 0.15; // After scroll, put playhead at 15% from left of visible area

  // Animation state for smooth playhead motion
  let animationFrameId: number | null = null;
  let lastSyncTime = 0; // performance.now() when we last synced with actual video time
  let lastSyncPosition = 0; // playhead position (0-1) at sync time
  let lastKnownPosition = 0; // For seek detection

  // Audio waveform - use new waveform service
  const mainWaveform = useWaveform();
  const waveformData = computed(() => mainWaveform.audioData.value);
  const isWaveformLoaded = computed(() => mainWaveform.isLoaded.value);

  // Load waveform from video using new service
  async function loadWaveformFromVideo(videoSrc: string): Promise<void> {
    await mainWaveform.load(videoSrc);
  }

  // Resize observer for waveform canvases
  let resizeObserver: ResizeObserver | null = null;

  // Convert dB to linear gain multiplier
  function dbToLinear(db: number): number {
    return Math.pow(10, db / 20);
  }

  // Normalize peaks for display - scales quiet audio to be visible
  function normalizePeaks(peaks: { min: number; max: number }[]): { min: number; max: number }[] {
    if (peaks.length === 0) return peaks;

    // Find the maximum amplitude in the waveform
    let maxAmplitude = 0;
    for (const peak of peaks) {
      const peakMax = Math.max(Math.abs(peak.min), Math.abs(peak.max));
      if (peakMax > maxAmplitude) {
        maxAmplitude = peakMax;
      }
    }

    // If waveform is already loud enough (>50% of full scale), don't normalize
    if (maxAmplitude >= 0.5 || maxAmplitude === 0) {
      return peaks;
    }

    // Calculate scale factor to bring max amplitude to ~85% of full scale
    // This leaves headroom while making quiet audio visible
    const targetAmplitude = 0.85;
    const scaleFactor = targetAmplitude / maxAmplitude;

    // Apply normalization (cap at reasonable max to avoid over-amplification of noise)
    const maxScale = 10; // Don't amplify more than 10x
    const finalScale = Math.min(scaleFactor, maxScale);

    return peaks.map((peak) => ({
      min: peak.min * finalScale,
      max: peak.max * finalScale,
    }));
  }

  // Color mappings - Enhanced gradients for CapCut style
  const colorMap: Record<string, { bg: string; border: string; glow: string }> = {
    violet: {
      bg: 'rgba(139, 92, 246, 0.35), rgba(99, 102, 241, 0.45)',
      border: 'rgba(139, 92, 246, 0.7)',
      glow: 'rgba(139, 92, 246, 0.3)',
    },
    emerald: {
      bg: 'rgba(16, 185, 129, 0.35), rgba(20, 184, 166, 0.45)',
      border: 'rgba(16, 185, 129, 0.7)',
      glow: 'rgba(16, 185, 129, 0.3)',
    },
    amber: {
      bg: 'rgba(245, 158, 11, 0.35), rgba(251, 146, 60, 0.45)',
      border: 'rgba(245, 158, 11, 0.7)',
      glow: 'rgba(245, 158, 11, 0.3)',
    },
    pink: {
      bg: 'rgba(236, 72, 153, 0.35), rgba(244, 114, 182, 0.45)',
      border: 'rgba(236, 72, 153, 0.7)',
      glow: 'rgba(236, 72, 153, 0.3)',
    },
    cyan: {
      bg: 'rgba(6, 182, 212, 0.35), rgba(34, 211, 238, 0.45)',
      border: 'rgba(6, 182, 212, 0.7)',
      glow: 'rgba(6, 182, 212, 0.3)',
    },
    rose: {
      bg: 'rgba(244, 63, 94, 0.35), rgba(251, 113, 133, 0.45)',
      border: 'rgba(244, 63, 94, 0.7)',
      glow: 'rgba(244, 63, 94, 0.3)',
    },
    sky: {
      bg: 'rgba(14, 165, 233, 0.35), rgba(56, 189, 248, 0.45)',
      border: 'rgba(14, 165, 233, 0.7)',
      glow: 'rgba(14, 165, 233, 0.3)',
    },
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

  // Compute the end time of all video sources (primary track content)
  const sourcesEndTime = computed(() => {
    if (!props.videoSources || props.videoSources.length === 0) return 0;
    return props.videoSources.reduce((max, s) => Math.max(max, s.end_time), 0);
  });

  // CapCut-style dynamic timeline duration - includes ALL item types
  // Timeline grows automatically when any item extends beyond current duration
  const totalDuration = computed(() => {
    let maxEndTime = 0;

    if (props.editorMode) {
      // Start with video sources end time
      if (props.videoSources && props.videoSources.length > 0) {
        maxEndTime = sourcesEndTime.value;
        // For single source, also consider the full source duration (for extension)
        if (props.videoSources.length === 1) {
          maxEndTime = Math.max(maxEndTime, props.videoSources[0].source_duration || 0);
        }
      }

      // Include audio tracks
      if (props.audioTracks && props.audioTracks.length > 0) {
        const maxAudioEnd = props.audioTracks.reduce((max, track) => Math.max(max, track.endTime), 0);
        maxEndTime = Math.max(maxEndTime, maxAudioEnd);
      }

      // Include text overlays
      if (props.textOverlays && props.textOverlays.length > 0) {
        const maxTextEnd = props.textOverlays.reduce((max, overlay) => Math.max(max, overlay.endTime), 0);
        maxEndTime = Math.max(maxEndTime, maxTextEnd);
      }

      // Include stickers
      if (props.stickers && props.stickers.length > 0) {
        const maxStickerEnd = props.stickers.reduce((max, sticker) => Math.max(max, sticker.endTime), 0);
        maxEndTime = Math.max(maxEndTime, maxStickerEnd);
      }

      // Include watermarks
      if (props.watermarks && props.watermarks.length > 0) {
        const maxWatermarkEnd = props.watermarks.reduce((max, wm) => Math.max(max, wm.endTime), 0);
        maxEndTime = Math.max(maxEndTime, maxWatermarkEnd);
      }

      // Include effects
      if (props.effects && props.effects.length > 0) {
        const maxEffectEnd = props.effects.reduce((max, effect) => Math.max(max, effect.endTime), 0);
        maxEndTime = Math.max(maxEndTime, maxEffectEnd);
      }

      // Minimum 5 minutes if nothing exists, or add 10% padding for extension room
      if (maxEndTime === 0) {
        return 300;
      }
      // Add 10% padding to allow easy extension
      return maxEndTime * 1.1;
    }

    // Clip mode (non-editor)
    const clipSpan = (props.clipEnd ?? 0) - (props.clipStart ?? 0);
    const segmentDuration = videoSegmentDuration.value;
    const maxAudioDuration = props.audioTracks.reduce((max, track) => {
      return Math.max(max, track.endTime);
    }, 0);
    const requestedDuration = props.duration || 0;
    maxEndTime = Math.max(segmentDuration, maxAudioDuration, clipSpan, requestedDuration);
    return maxEndTime > 0 ? maxEndTime : props.duration;
  });

  // Primary video sources (track_index = 0 or undefined) - shown in Source track
  const primaryVideoSources = computed(() => {
    if (!props.editorMode) return [];
    return props.videoSources.filter((source) => (source.track_index ?? 0) === 0);
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
    // Priority: Unified Tracks (Editor Mode 2.0)
    if (unifiedVideoTracks.value.length > 0) {
      return unifiedVideoTracks.value
        .filter((t) => t.orderIndex > 0) // Skip main track (index 0)
        .sort((a, b) => b.orderIndex - a.orderIndex) // Highest layer first (render on top)
        .map((track) => ({
          layer: track.orderIndex - 1, // Map Track 1 to Layer 0
          items: track.items.map((tItem) => {
            const baseItem = tItem.originalData || {};
            // Map unified TimelineItem back to component-specific item structure
            // This handles the bridge between snake_case DB records and camelCase props used in template
            let type: LayerItem['type'] = 'source';
            const item: any = { ...baseItem };
            item.keyframes = tItem.keyframes;

            if (tItem.type === 'video') {
              // Could be source or watermark
              if ('watermark_id' in baseItem) {
                type = 'watermark';
                item.startTime = tItem.startTime;
                item.endTime = tItem.startTime + tItem.duration;
              } else {
                type = 'source';
                // Sources use snake_case start_time which is already in baseItem
                // Also map to camelCase for generic handler compatibility
                item.startTime = tItem.startTime;
                item.endTime = tItem.startTime + tItem.duration;
                item.trimStart = tItem.trimStart;
                item.trimEnd = tItem.trimEnd;
              }
            } else if (tItem.type === 'text') {
              type = 'text';
              item.startTime = tItem.startTime;
              item.endTime = tItem.startTime + tItem.duration;
              item.text = baseItem.text;
            } else if (tItem.type === 'sticker') {
              type = 'sticker';
              item.startTime = tItem.startTime;
              item.endTime = tItem.startTime + tItem.duration;
              item.stickerPath = baseItem.sticker_path;
              item.stickerType = baseItem.sticker_type;
            }

            return { type, item };
          }),
        }));
    }

    // Fallback: Legacy / Manual Layer construction
    const layerMap = new Map<number, LayerItem[]>();

    // Add video sources with track_index > 0 (these go to layers above Source)
    // Map track_index to layer: track_index 1 → layer 0, track_index 2 → layer 1, etc.
    if (props.editorMode) {
      props.videoSources.forEach((source) => {
        const trackIndex = source.track_index ?? 0;
        if (trackIndex > 0) {
          // Only sources above the primary track
          const layer = trackIndex - 1; // Map: track_index 1 → layer 0, 2 → layer 1, etc.
          if (!layerMap.has(layer)) layerMap.set(layer, []);
          layerMap.get(layer)!.push({ type: 'source', item: source });
        }
      });
    }

    // Add text overlays
    props.textOverlays.forEach((item) => {
      const layer = item.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push({ type: 'text', item });
    });

    // Add stickers
    props.stickers.forEach((item) => {
      const layer = item.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push({ type: 'sticker', item });
    });

    // Add watermarks
    props.watermarks.forEach((item) => {
      const layer = item.layer ?? 0;
      if (!layerMap.has(layer)) layerMap.set(layer, []);
      layerMap.get(layer)!.push({ type: 'watermark', item });
    });

    // Also ensure target layer exists during drag (for visual feedback)
    // Access the full dragSourceInfo to ensure Vue tracks it reactively
    const sourceDragInfo = dragSourceInfo.value;
    const overlayDragInfo = dragInfo.value;
    const isDraggingToLayer =
      (isDragging.value && overlayDragInfo?.targetLayer !== undefined) ||
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

  // Calculate visible beat markers with correct positioning
  const visibleBeatMarkers = computed(() => {
    if (!props.beatMarkers || props.beatMarkers.length === 0) return [];

    const visibleStart = props.clipStart;
    const visibleEnd = props.clipEnd;
    const visibleDuration = visibleEnd - visibleStart;

    return props.beatMarkers
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

  // Calculate visible chapter markers with correct positioning
  const visibleChapterMarkers = computed(() => {
    if (!props.chapterMarkers || props.chapterMarkers.length === 0) return [];

    const visibleStart = props.clipStart;
    const visibleEnd = props.clipEnd;
    const visibleDuration = visibleEnd - visibleStart;

    return props.chapterMarkers
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

  // Ruler ticks spanning full timeline - VIRTUALIZED
  // Uses debounced ticksZoomLevel for performance - only recalculates after zoom settles
  // Only generates ticks for the visible viewport + buffer to prevent DOM bloat
  const rulerTicks = computed(() => {
    const timelineDuration = totalDuration.value;
    if (timelineDuration <= 0) return [];

    // Use debounced zoom level for tick calculations to prevent recalc on every scroll frame
    const effectiveZoom = ticksZoomLevel.value;
    const visibleDuration = timelineDuration / effectiveZoom;
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

    // When actively zooming, show only major ticks for performance
    // This dramatically reduces DOM updates during scroll-to-zoom
    const showMinorTicks = !isZooming.value;
    const tickInterval = showMinorTicks ? minorInterval : majorInterval;

    // VIRTUALIZATION: Only generate ticks for the visible time range + buffer
    // This prevents thousands of DOM elements when zoomed in far
    const { visibleStartTime, visibleEndTime, bufferTime } = virtualScrollState.value;

    // Add buffer on each side for smooth scrolling (prevents popping)
    const renderStartTime = Math.max(0, visibleStartTime - bufferTime);
    const renderEndTime = Math.min(timelineDuration, visibleEndTime + bufferTime);

    // Align start time to tick interval for consistent positioning
    const alignedStartTime = Math.floor(renderStartTime / tickInterval) * tickInterval;

    // Safety cap: limit maximum number of ticks to prevent extreme cases
    const MAX_TICKS = 300;

    const ticks: { key: string; time: number; percent: number; isMajor: boolean }[] = [];
    for (let t = alignedStartTime; t <= renderEndTime + 0.0001 && ticks.length < MAX_TICKS; t += tickInterval) {
      // Skip ticks outside the timeline bounds
      if (t < 0 || t > timelineDuration) continue;

      const percent = (t / timelineDuration) * 100;
      const isMajor = Math.abs(t % majorInterval) < 0.001 || Math.abs((t % majorInterval) - majorInterval) < 0.001;
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
  // NOTE: Tick generation removed for performance - ruler ticks are rendered separately
  const segmentLayouts = computed((): SegmentLayout[] => {
    const timelineDuration = totalDuration.value;
    if (timelineDuration <= 0) return [];

    // Editor mode: create a single linear timeline layout (no segment gaps)
    if (props.editorMode) {
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

      layouts.push({
        segment,
        startPercent: currentPercent,
        widthPercent,
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
    // Use preview position for both resize AND drag end (to show segment at new position before props update)
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === 'audio' && preview.id === track.id;

    const audioStart = usePreview ? preview.startTime : track.startTime;
    const audioEnd = usePreview ? preview.endTime : track.endTime;
    const audioDuration = audioEnd - audioStart;

    if (audioDuration <= 0) return [];

    // Editor mode: simple linear layout (no video segments to align with)
    if (props.editorMode) {
      // Use totalDuration for consistency with video source positioning
      const duration = totalDuration.value;
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
    if (isNaN(seconds) || !isFinite(seconds)) return '0';

    // Special case: show just "0" for the first timestamp
    if (seconds === 0) return '0';

    const mins = Math.floor(seconds / 60);
    const secs = seconds - mins * 60;
    const secsWithHundredths = secs.toFixed(2); // always show hundredths

    if (mins === 0) {
      return `${secsWithHundredths}s`;
    }

    // Pad seconds to include leading zero and hundredths (e.g., 01:05.23)
    const [wholeSecs, hundredths] = secsWithHundredths.split('.');
    return `${mins}:${wholeSecs.padStart(2, '0')}.${hundredths}`;
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

  /**
   * Get style for ghost preview showing original position during drag
   */
  function getGhostPreviewStyle(type: string): Record<string, string> {
    // Get the original position from dragSourceInfo or dragInfo
    let originalStartTime = 0;
    let originalEndTime = 0;

    if (type === 'source' && dragSourceInfo.value) {
      originalStartTime = dragSourceInfo.value.originalStartTime;
      originalEndTime = dragSourceInfo.value.originalEndTime;
    } else if (dragInfo.value) {
      originalStartTime = dragInfo.value.originalStartTime;
      originalEndTime = dragInfo.value.originalEndTime;
    } else {
      return { display: 'none' };
    }

    const duration = props.editorMode ? props.duration : totalDuration.value;
    if (duration <= 0) return { display: 'none' };

    const left = (originalStartTime / duration) * 100;
    const width = ((originalEndTime - originalStartTime) / duration) * 100;

    return {
      left: `${left}%`,
      width: `${Math.max(width, 0.5)}%`,
    };
  }

  function getAudioVisualSegmentStyle(track: AudioTrack, visualSeg: AudioVisualSegment): Record<string, string> {
    const colors = colorMap.emerald;
    const isSelected = selectedItemKey.value === `audio_${track.id}`;

    // Check if this audio track is being dragged - hide completely so ghost is the only visual
    const isDraggingThis = isDragging.value && dragInfo.value?.type === 'audio' && dragInfo.value?.id === track.id;

    return {
      left: `${visualSeg.leftPercent}%`,
      width: `${Math.max(visualSeg.widthPercent, 0.5)}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
      opacity: isDraggingThis ? '0' : '1',
      pointerEvents: isDraggingThis ? 'none' : 'auto',
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

    // Use preview position for both resize AND drag end (to show segment at new position before props update)
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

    // Check if this audio track is being dragged - hide completely so ghost is the only visual
    const isDraggingThis = isDragging.value && dragInfo.value?.type === 'audio' && dragInfo.value?.id === track.id;

    return {
      left: `${leftPercent}%`,
      width: `${Math.max(widthPercent, 1)}%`,
      background: `linear-gradient(to right, ${colors.bg})`,
      borderColor: isSelected ? '#3b82f6' : colors.border,
      borderWidth: '1px',
      borderStyle: 'solid',
      opacity: isDraggingThis ? '0' : '1',
      pointerEvents: isDraggingThis ? 'none' : 'auto',
    };
  }

  function selectItem(type: ItemType, id: string, autoSelectLinked: boolean = true) {
    selectedItemKey.value = `${type}_${id}`;

    // Linked selection: auto-select linked audio when selecting video source
    if (autoSelectLinked && type === 'source' && props.editorMode) {
      // Find any audio tracks linked to this source
      const linkedAudio = props.audioTracks.filter((track) => track.linkedSourceId === id);
      if (linkedAudio.length > 0) {
        // Emit selection for linked audio tracks (add to selection)
        linkedAudio.forEach((track) => {
          emit('sourceSelect', track.id, { shift: false, ctrl: true });
        });
      }
    }

    // Reverse: when selecting audio, also select linked video source
    if (autoSelectLinked && type === 'audio') {
      const audioTrack = props.audioTracks.find((t) => t.id === id);
      if (audioTrack?.linkedSourceId) {
        // Also select the linked video source
        emit('sourceSelect', audioTrack.linkedSourceId, { shift: false, ctrl: true });
      }
    }
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
      classes.push('cursor-grabbing', 'z-30', 'shadow-2xl', 'dragging');
    } else if (isResizing.value && resizeInfo.value?.type === type && resizeInfo.value?.id === id) {
      classes.push('cursor-ew-resize', 'z-30', 'shadow-xl', 'resizing');
    } else if (isSourceDragging) {
      classes.push('cursor-grabbing', 'z-30', 'shadow-2xl', 'dragging');
    } else {
      classes.push(
        'cursor-grab',
        'hover:cursor-grab',
        'transition-all',
        'duration-150',
        'ease-out',
        'hover:brightness-110'
      );
    }

    if (isDeleted) {
      classes.push('opacity-25', 'grayscale');
    }

    if (selectedItemKey.value === key) {
      classes.push('selected-segment');
    }

    // Ripple preview: highlight segments that will be affected by ripple edit
    if (rippleAffectedIds.value.has(id)) {
      classes.push('ring-2', 'ring-orange-400/70', 'ring-offset-1', 'ring-offset-black', 'ripple-affected');
    }

    // Collision indicator: highlight segments that overlap with other segments
    if (collidingSegmentIds.value.has(id)) {
      classes.push('ring-2', 'ring-red-500/80', 'ring-offset-1', 'ring-offset-black', 'collision-warning');
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

    // Check if this segment is being dragged - hide completely so ghost is the only visual
    const isDraggingThis = isDragging.value && dragInfo.value?.type === type && dragInfo.value?.id === id;

    return {
      left: `${layout.startPercent}%`,
      width: `${layout.widthPercent}%`,
      background: `linear-gradient(135deg, ${colors.bg})`,
      borderColor: isSelected ? 'rgba(255, 255, 255, 0.6)' : colors.border,
      borderWidth: isSelected ? '2px' : '1px',
      borderStyle: 'solid',
      borderRadius: '6px',
      boxShadow: isSelected ? `0 0 12px ${colors.glow}` : 'none',
      opacity: isDraggingThis ? '0' : '1',
      pointerEvents: isDraggingThis ? 'none' : 'auto',
    };
  }

  // Convert effective time to visual percentage position (accounting for segment gaps in clip mode)
  function effectiveTimeToVisualPercent(effectiveTime: number): number {
    // Editor mode: simple linear mapping (no segment gaps)
    if (props.editorMode) {
      const duration = totalDuration.value || props.duration || 300;
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

    // Use preview position for both resize AND drag end (to show segment at new position before props update)
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === type && preview.id === id;

    const actualStartTime = usePreview ? preview.startTime : startTime;
    const actualEndTime = usePreview ? preview.endTime : endTime;

    // Convert effective times to visual positions (accounting for gaps)
    const leftPercent = effectiveTimeToVisualPercent(actualStartTime);
    const rightPercent = effectiveTimeToVisualPercent(actualEndTime);
    const widthPercent = Math.max(rightPercent - leftPercent, 1);

    // Check if this item is being dragged - hide completely so ghost is the only visual
    const isDraggingThis = isDragging.value && dragInfo.value?.type === type && dragInfo.value?.id === id;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      background: `linear-gradient(135deg, ${colors.bg})`,
      borderColor: isSelected ? 'rgba(255, 255, 255, 0.6)' : colors.border,
      borderWidth: isSelected ? '2px' : '1px',
      borderStyle: 'solid',
      borderRadius: '6px',
      boxShadow: isSelected ? `0 0 12px ${colors.glow}` : 'none',
      opacity: isDraggingThis ? '0' : '1',
      pointerEvents: isDraggingThis ? 'none' : 'auto',
    };
  }

  function getFilterSegmentStyle(filterSeg: FilterSegment): Record<string, string> {
    const colors = colorMap.rose; // Use rose/pink for filters
    const isSelected = selectedItemKey.value === `filter_${filterSeg.id}`;

    // Use preview position for both resize AND drag end (to show segment at new position before props update)
    const preview = dragPreview.value;
    const usePreview = preview && preview.type === 'filter' && preview.id === filterSeg.id;

    const startTime = usePreview ? preview.startTime : filterSeg.startTime;
    const endTime = usePreview ? preview.endTime : filterSeg.endTime;

    // Convert effective times to visual positions (accounting for gaps)
    const leftPercent = effectiveTimeToVisualPercent(startTime);
    const rightPercent = effectiveTimeToVisualPercent(endTime);
    const widthPercent = Math.max(rightPercent - leftPercent, 1);

    // Check if this item is being dragged - hide completely so ghost is the only visual
    const isDraggingThis = isDragging.value && dragInfo.value?.type === 'filter' && dragInfo.value?.id === filterSeg.id;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      background: `linear-gradient(135deg, ${colors.bg})`,
      borderColor: isSelected ? 'rgba(255, 255, 255, 0.6)' : colors.border,
      borderWidth: isSelected ? '2px' : '1px',
      borderStyle: 'solid',
      borderRadius: '6px',
      boxShadow: isSelected ? `0 0 12px ${colors.glow}` : 'none',
      opacity: isDraggingThis ? '0' : '1',
      pointerEvents: isDraggingThis ? 'none' : 'auto',
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
      return rulerContentRef.value.clientWidth;
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
  type SnapEdgeType = 'segment-start' | 'segment-end' | 'playhead' | 'marker' | 'grid';
  type SnapTrackType = 'video' | 'audio' | 'text' | 'sticker' | 'watermark' | 'effect' | 'filter' | 'system';

  interface SnapTarget {
    time: number;
    type: SnapEdgeType;
    trackType?: SnapTrackType; // Track type for cross-track snapping visual feedback
    itemId?: string; // ID of the item this snap target belongs to
  }

  interface SnapResult {
    time: number;
    didSnap: boolean;
    snapTarget?: SnapTarget;
  }

  /**
   * Get all snap targets (segment edges) from ALL tracks for cross-track snapping
   * This enables CapCut-style snapping where items snap to edges on any layer
   */
  function getSnapTargets(excludeId?: string): SnapTarget[] {
    const targets: SnapTarget[] = [];
    // Only use preview for resize operations (drag uses CSS transforms now)
    const preview = isResizing.value ? dragPreview.value : null;

    if (props.editorMode) {
      // Editor mode: collect video source edges
      for (const source of props.videoSources) {
        if (source.id === excludeId) continue;

        const isPreviewing = preview && preview.type === 'source' && preview.id === source.id;
        const startTime = isPreviewing ? preview.startTime : source.start_time;
        const endTime = isPreviewing ? preview.endTime : source.end_time;

        targets.push({ time: startTime, type: 'segment-start', trackType: 'video', itemId: source.id });
        targets.push({ time: endTime, type: 'segment-end', trackType: 'video', itemId: source.id });
      }
    } else {
      // Clip mode: collect trim segment edges
      for (const segment of sortedTrimSegments.value) {
        if (segment.id === excludeId) continue;

        const startTime =
          preview && preview.type === 'trim' && preview.id === segment.id ? preview.startTime : segment.startTime;
        const endTime =
          preview && preview.type === 'trim' && preview.id === segment.id ? preview.endTime : segment.endTime;

        targets.push({ time: startTime, type: 'segment-start', trackType: 'video', itemId: segment.id });
        targets.push({ time: endTime, type: 'segment-end', trackType: 'video', itemId: segment.id });
      }
    }

    // Cross-track snapping: Collect edges from audio tracks
    for (const track of props.audioTracks) {
      if (track.id === excludeId) continue;

      const isPreviewing = preview && preview.type === 'audio' && preview.id === track.id;
      const startTime = isPreviewing ? preview.startTime : track.startTime;
      const endTime = isPreviewing ? preview.endTime : track.endTime;

      targets.push({ time: startTime, type: 'segment-start', trackType: 'audio', itemId: track.id });
      targets.push({ time: endTime, type: 'segment-end', trackType: 'audio', itemId: track.id });
    }

    // Cross-track snapping: Collect edges from text overlays
    for (const overlay of props.textOverlays) {
      if (overlay.id === excludeId) continue;

      const isPreviewing = preview && preview.type === 'text' && preview.id === overlay.id;
      const startTime = isPreviewing ? preview.startTime : overlay.startTime;
      const endTime = isPreviewing ? preview.endTime : overlay.endTime;

      targets.push({ time: startTime, type: 'segment-start', trackType: 'text', itemId: overlay.id });
      targets.push({ time: endTime, type: 'segment-end', trackType: 'text', itemId: overlay.id });
    }

    // Cross-track snapping: Collect edges from stickers
    for (const sticker of props.stickers) {
      if (sticker.id === excludeId) continue;

      const isPreviewing = preview && preview.type === 'sticker' && preview.id === sticker.id;
      const startTime = isPreviewing ? preview.startTime : sticker.startTime;
      const endTime = isPreviewing ? preview.endTime : sticker.endTime;

      targets.push({ time: startTime, type: 'segment-start', trackType: 'sticker', itemId: sticker.id });
      targets.push({ time: endTime, type: 'segment-end', trackType: 'sticker', itemId: sticker.id });
    }

    // Cross-track snapping: Collect edges from watermarks
    for (const watermark of props.watermarks) {
      if (watermark.id === excludeId) continue;

      const isPreviewing = preview && preview.type === 'watermark' && preview.id === watermark.id;
      const startTime = isPreviewing ? preview.startTime : watermark.startTime;
      const endTime = isPreviewing ? preview.endTime : watermark.endTime;

      targets.push({ time: startTime, type: 'segment-start', trackType: 'watermark', itemId: watermark.id });
      targets.push({ time: endTime, type: 'segment-end', trackType: 'watermark', itemId: watermark.id });
    }

    // Cross-track snapping: Collect edges from effects
    for (const effect of props.effects) {
      if (effect.id === excludeId) continue;

      const isPreviewing = preview && preview.type === 'effect' && preview.id === effect.id;
      const startTime = isPreviewing ? preview.startTime : effect.startTime;
      const endTime = isPreviewing ? preview.endTime : effect.endTime;

      targets.push({ time: startTime, type: 'segment-start', trackType: 'effect', itemId: effect.id });
      targets.push({ time: endTime, type: 'segment-end', trackType: 'effect', itemId: effect.id });
    }

    // Cross-track snapping: Collect edges from filter segments
    for (const filter of props.filterSegments) {
      if (filter.id === excludeId) continue;

      const isPreviewing = preview && preview.type === 'filter' && preview.id === filter.id;
      const startTime = isPreviewing ? preview.startTime : filter.startTime;
      const endTime = isPreviewing ? preview.endTime : filter.endTime;

      targets.push({ time: startTime, type: 'segment-start', trackType: 'filter', itemId: filter.id });
      targets.push({ time: endTime, type: 'segment-end', trackType: 'filter', itemId: filter.id });
    }

    // Snap to markers if available and enabled
    if (snapPreferences.value.markers && props.markers && props.markers.length > 0) {
      for (const marker of props.markers) {
        targets.push({ time: marker.time, type: 'marker', trackType: 'system', itemId: marker.id });
      }
    }

    // Add playhead as a snap target if enabled
    if (snapPreferences.value.playhead) {
      targets.push({ time: props.currentTime, type: 'playhead', trackType: 'system' });
    }

    // Add grid snap targets if enabled (1 second intervals)
    if (snapPreferences.value.grid) {
      const maxDuration = props.editorMode ? props.duration : totalDuration.value;
      for (let t = 0; t <= maxDuration; t += 1) {
        targets.push({ time: t, type: 'grid', trackType: 'system' });
      }
    }

    // Add timeline boundaries (always included with segment edges)
    if (snapPreferences.value.segmentEdges) {
      targets.push({ time: 0, type: 'segment-start', trackType: 'system' });
      const maxDuration = props.editorMode ? props.duration : totalDuration.value;
      if (maxDuration > 0) {
        targets.push({ time: maxDuration, type: 'segment-end', trackType: 'system' });
      }
    }

    // Filter out segment edges if not enabled
    if (!snapPreferences.value.segmentEdges) {
      return targets.filter((t) => t.type !== 'segment-start' && t.type !== 'segment-end');
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
   * Uses magnetic threshold (larger) when magnetic mode is enabled for attraction effect
   */
  function applySnapToTime(targetTime: number, excludeId?: string): SnapResult {
    if (!snapEnabled.value) {
      return { time: targetTime, didSnap: false };
    }

    const targets = getSnapTargets(excludeId);
    const targetPixel = timeToPixelPosition(targetTime);

    // Use magnetic threshold if enabled, otherwise use regular snap threshold
    const threshold = snapPreferences.value.magnetic ? MAGNETIC_THRESHOLD_PX : SNAP_THRESHOLD_PX;

    let closestTarget: SnapTarget | null = null;
    let closestDistance = Infinity;

    for (const target of targets) {
      const targetTimePixel = timeToPixelPosition(target.time);
      const distance = Math.abs(targetPixel - targetTimePixel);

      if (distance <= threshold && distance < closestDistance) {
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
   * Also returns snapTrackType for cross-track snap visual feedback
   */
  function applySnapToSegment(
    startTime: number,
    endTime: number,
    excludeId?: string
  ): { startTime: number; endTime: number; didSnap: boolean; snapTime: number | null; snapTrackType: string | null } {
    if (!snapEnabled.value) {
      return { startTime, endTime, didSnap: false, snapTime: null, snapTrackType: null };
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
        snapTrackType: startSnap.snapTarget?.trackType || null,
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
        snapTrackType: endSnap.snapTarget?.trackType || null,
      };
    }

    return { startTime, endTime, didSnap: false, snapTime: null, snapTrackType: null };
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

    // Use contentWrapperRef for consistency with playhead position calculation
    if (!contentWrapperRef.value) return;

    const wrapperRect = contentWrapperRef.value.getBoundingClientRect();
    const cursorXInWrapper = e.clientX - wrapperRect.left;

    // Account for the 120px track label area
    const contentAreaX = cursorXInWrapper - TRACK_LABEL_WIDTH;
    const contentAreaWidth = wrapperRect.width - TRACK_LABEL_WIDTH;

    const percent = Math.max(0, Math.min(1, contentAreaX / contentAreaWidth));
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
    // Use contentWrapperRef for consistency with playhead position calculation
    if (!contentWrapperRef.value) return;

    const wrapperRect = contentWrapperRef.value.getBoundingClientRect();
    const cursorXInWrapper = e.clientX - wrapperRect.left;

    // Account for the 120px track label area
    const contentAreaX = cursorXInWrapper - TRACK_LABEL_WIDTH;
    const contentAreaWidth = wrapperRect.width - TRACK_LABEL_WIDTH;

    const percent = Math.max(0, Math.min(1, contentAreaX / contentAreaWidth));
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

  /**
   * Copy selected items to clipboard (emits event for parent to handle)
   */
  function copySelectedItems() {
    const itemKeys: string[] = [];

    // Collect selected items from both modes
    if (props.editorMode && props.selectedSourceIds && props.selectedSourceIds.size > 0) {
      // Editor mode: collect selected sources
      for (const sourceId of props.selectedSourceIds) {
        itemKeys.push(`source_${sourceId}`);
      }
    } else if (!props.editorMode && props.selectedSegmentIds && props.selectedSegmentIds.size > 0) {
      // Clip mode: collect selected segments
      for (const segmentId of props.selectedSegmentIds) {
        itemKeys.push(`trim_${segmentId}`);
      }
    } else if (selectedItemKey.value) {
      // Single selection fallback
      itemKeys.push(selectedItemKey.value);
    }

    if (itemKeys.length > 0) {
      emit('copyItems', itemKeys);
    }
  }

  /**
   * Paste items at current playhead position
   */
  function pasteItems() {
    emit('pasteItems', props.currentTime);
  }

  /**
   * Paste items at their original position (paste in place)
   */
  function pasteItemsInPlace() {
    emit('pasteItemsInPlace');
  }

  /**
   * Paste items to a specific track (cross-track paste)
   */
  function pasteItemsToTrack(targetTrackType: string, targetTrackId?: string) {
    emit('pasteItemsToTrack', {
      position: props.currentTime,
      targetTrackType,
      targetTrackId,
    });
  }

  /**
   * Duplicate selected items (copy + paste in place)
   */
  function duplicateSelectedItems() {
    const itemKeys: string[] = [];

    // Collect selected items from both modes
    if (props.editorMode && props.selectedSourceIds && props.selectedSourceIds.size > 0) {
      for (const sourceId of props.selectedSourceIds) {
        itemKeys.push(`source_${sourceId}`);
      }
    } else if (!props.editorMode && props.selectedSegmentIds && props.selectedSegmentIds.size > 0) {
      for (const segmentId of props.selectedSegmentIds) {
        itemKeys.push(`trim_${segmentId}`);
      }
    } else if (selectedItemKey.value) {
      itemKeys.push(selectedItemKey.value);
    }

    if (itemKeys.length > 0) {
      emit('duplicateItems', itemKeys);
    }
  }

  /**
   * Add a marker at the current playhead position
   */
  function addMarkerAtPlayhead() {
    emit('addMarker', props.currentTime);
  }

  /**
   * Group selected items together
   */
  function groupSelectedItems() {
    const itemKeys: string[] = [];

    if (props.editorMode && props.selectedSourceIds && props.selectedSourceIds.size > 1) {
      for (const sourceId of props.selectedSourceIds) {
        itemKeys.push(`source_${sourceId}`);
      }
    } else if (!props.editorMode && props.selectedSegmentIds && props.selectedSegmentIds.size > 1) {
      for (const segmentId of props.selectedSegmentIds) {
        itemKeys.push(`trim_${segmentId}`);
      }
    }

    if (itemKeys.length > 1) {
      emit('groupItems', itemKeys);
    }
  }

  /**
   * Ungroup the currently selected group
   */
  function ungroupSelectedItems() {
    // If the selected item is a group, ungroup it
    if (selectedItemKey.value && selectedItemKey.value.startsWith('group_')) {
      const groupId = selectedItemKey.value.replace('group_', '');
      emit('ungroupItems', groupId);
    }
  }

  /**
   * Add a speed keyframe to a video source at the current playhead position
   */
  function addSpeedKeyframeAtPlayhead(sourceId: string, speed: number = 1.0) {
    const source = props.videoSources.find((s) => s.id === sourceId);
    if (!source) return;

    // Calculate time relative to source start
    const relativeTime = props.currentTime - source.start_time;
    if (relativeTime < 0 || relativeTime > source.end_time - source.start_time) return;

    emit('addSpeedKeyframe', sourceId, relativeTime, speed);
  }

  /**
   * Add a freeze point at the current playhead position
   */
  function addFreezePointAtPlayhead(sourceId: string, duration: number = 1.0) {
    const source = props.videoSources.find((s) => s.id === sourceId);
    if (!source) return;

    // Calculate time relative to source start
    const relativeTime = props.currentTime - source.start_time;
    if (relativeTime < 0 || relativeTime > source.end_time - source.start_time) return;

    emit('addFreezePoint', sourceId, relativeTime, duration);
  }

  /**
   * Start track reordering drag
   */
  function onTrackReorderStart(e: MouseEvent, trackType: 'audio' | 'overlay', trackId: string, currentOrder: number) {
    e.preventDefault();
    e.stopPropagation();

    // Calculate max order for clamping based on track type
    const maxOrder = trackType === 'audio' ? Math.max(0, props.audioTracks.length - 1) : 0; // Overlay tracks use layers, not order

    trackReorderState.value = {
      trackType,
      trackId,
      originalOrder: currentOrder,
      startY: e.clientY,
      lastEmittedOrder: currentOrder,
      maxOrder,
    };

    document.addEventListener('mousemove', onTrackReorderMove);
    document.addEventListener('mouseup', onTrackReorderEnd);
  }

  /**
   * Handle track reordering drag movement
   */
  function onTrackReorderMove(e: MouseEvent) {
    if (!trackReorderState.value) return;

    // Calculate total delta from the ORIGINAL start position (never update startY)
    const deltaY = e.clientY - trackReorderState.value.startY;
    const trackHeight = 48; // Approximate track height
    const positionDelta = Math.round(deltaY / trackHeight);

    // Calculate new order from the ORIGINAL order (never update originalOrder)
    const rawNewOrder = trackReorderState.value.originalOrder + positionDelta;

    // Clamp to valid range before emitting
    const clampedOrder = Math.max(0, Math.min(trackReorderState.value.maxOrder, rawNewOrder));

    // Only emit if the clamped order differs from the last emitted value
    if (clampedOrder !== trackReorderState.value.lastEmittedOrder) {
      emit('reorderTrack', trackReorderState.value.trackType, trackReorderState.value.trackId, clampedOrder);
      trackReorderState.value.lastEmittedOrder = clampedOrder;
    }
  }

  /**
   * End track reordering drag
   */
  function onTrackReorderEnd() {
    trackReorderState.value = null;
    document.removeEventListener('mousemove', onTrackReorderMove);
    document.removeEventListener('mouseup', onTrackReorderEnd);
  }

  /**
   * Start marquee selection on empty timeline area
   */
  function onTimelineMarqueeStart(e: MouseEvent) {
    // Only start marquee if clicking on empty area (not on a segment)
    if ((e.target as HTMLElement).closest('.clip-segment')) return;
    if (!timelineScrollContainer.value) return;

    const rect = timelineScrollContainer.value.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScrollContainer.value.scrollLeft;
    const y = e.clientY - rect.top + timelineScrollContainer.value.scrollTop;

    marqueeSelection.value = {
      active: true,
      startX: x,
      startY: y,
      currentX: x,
      currentY: y,
    };

    document.addEventListener('mousemove', onTimelineMarqueeMove);
    document.addEventListener('mouseup', onTimelineMarqueeEnd);
  }

  /**
   * Update marquee selection rectangle during drag
   */
  function onTimelineMarqueeMove(e: MouseEvent) {
    if (!marqueeSelection.value || !timelineScrollContainer.value) return;

    const rect = timelineScrollContainer.value.getBoundingClientRect();
    const x = e.clientX - rect.left + timelineScrollContainer.value.scrollLeft;
    const y = e.clientY - rect.top + timelineScrollContainer.value.scrollTop;

    marqueeSelection.value.currentX = x;
    marqueeSelection.value.currentY = y;
  }

  /**
   * End marquee selection and select items within rectangle
   */
  function onTimelineMarqueeEnd() {
    if (!marqueeSelection.value || !timelineScrollContainer.value) {
      marqueeSelection.value = null;
      document.removeEventListener('mousemove', onTimelineMarqueeMove);
      document.removeEventListener('mouseup', onTimelineMarqueeEnd);
      return;
    }

    const { startX, startY, currentX, currentY } = marqueeSelection.value;
    const left = Math.min(startX, currentX);
    const right = Math.max(startX, currentX);
    const top = Math.min(startY, currentY);
    const bottom = Math.max(startY, currentY);

    // Only process if marquee is larger than 10px (avoid accidental clicks)
    if (right - left > 10 && bottom - top > 10) {
      const selectedIds: string[] = [];

      // Check each source segment for intersection with marquee
      if (props.editorMode) {
        for (const source of primaryVideoSources.value) {
          const segmentEl = segmentRefs.value.get(`source_${source.id}`);
          if (segmentEl) {
            const segRect = segmentEl.getBoundingClientRect();
            const containerRect = timelineScrollContainer.value!.getBoundingClientRect();

            // Convert segment rect to container-relative coordinates
            const segLeft = segRect.left - containerRect.left + timelineScrollContainer.value!.scrollLeft;
            const segRight = segRect.right - containerRect.left + timelineScrollContainer.value!.scrollLeft;
            const segTop = segRect.top - containerRect.top + timelineScrollContainer.value!.scrollTop;
            const segBottom = segRect.bottom - containerRect.top + timelineScrollContainer.value!.scrollTop;

            // Check intersection
            if (segLeft < right && segRight > left && segTop < bottom && segBottom > top) {
              selectedIds.push(source.id);
            }
          }
        }

        // Emit multi-select events for each selected source
        if (selectedIds.length > 0) {
          // First source without modifier, rest with ctrl to add to selection
          selectedIds.forEach((id, index) => {
            emit('sourceSelect', id, { shift: false, ctrl: index > 0 });
          });
        }
      }
    }

    marqueeSelection.value = null;
    document.removeEventListener('mousemove', onTimelineMarqueeMove);
    document.removeEventListener('mouseup', onTimelineMarqueeEnd);
  }

  /**
   * Handle fade handle mouse down - start dragging fade duration
   */
  function onFadeHandleMouseDown(e: MouseEvent, trackId: string, fadeType: 'fadeIn' | 'fadeOut', track: AudioTrack) {
    e.preventDefault();
    e.stopPropagation();

    const trackDuration = track.endTime - track.startTime;
    const originalFade = fadeType === 'fadeIn' ? track.fadeIn : track.fadeOut;

    fadeHandleState.value = {
      trackId,
      fadeType,
      startX: e.clientX,
      originalFade,
      trackDuration,
      trackElement: e.currentTarget as HTMLElement,
    };

    document.addEventListener('mousemove', onFadeHandleMouseMove);
    document.addEventListener('mouseup', onFadeHandleMouseUp);
  }

  function onFadeHandleMouseMove(e: MouseEvent) {
    if (!fadeHandleState.value) return;

    const { trackId, fadeType, startX, originalFade, trackDuration, trackElement } = fadeHandleState.value;

    // Get the parent track element to calculate width
    const parentEl = trackElement?.closest('.clip-segment') as HTMLElement;
    if (!parentEl) return;

    const trackWidth = parentEl.offsetWidth;
    const deltaX = e.clientX - startX;

    // Convert pixel delta to time delta
    const timeDelta = (deltaX / trackWidth) * trackDuration;

    // Calculate new fade duration
    let newFade: number;
    if (fadeType === 'fadeIn') {
      // Dragging right increases fade in
      newFade = Math.max(0, Math.min(trackDuration * 0.5, originalFade + timeDelta));
    } else {
      // Dragging left increases fade out (negative delta)
      newFade = Math.max(0, Math.min(trackDuration * 0.5, originalFade - timeDelta));
    }

    // Emit the update
    emit('updateAudioFade', trackId, fadeType, newFade);
  }

  function onFadeHandleMouseUp() {
    fadeHandleState.value = null;
    document.removeEventListener('mousemove', onFadeHandleMouseMove);
    document.removeEventListener('mouseup', onFadeHandleMouseUp);
  }

  /**
   * Enable audio ducking for a track (auto-lower music under speech)
   */
  function enableAudioDucking(
    trackId: string,
    options?: { threshold?: number; reduction?: number; attack?: number; release?: number }
  ) {
    const defaultOptions = {
      threshold: -20, // dB threshold for ducking trigger
      reduction: -12, // dB reduction when ducking
      attack: 0.1, // seconds to duck down
      release: 0.5, // seconds to recover
    };
    emit('enableAudioDucking', trackId, { ...defaultOptions, ...options });
    trackRecentAction('audio-ducking', 'Enable Audio Ducking');
  }

  /**
   * Disable audio ducking for a track
   */
  function disableAudioDucking(trackId: string) {
    emit('disableAudioDucking', trackId);
  }

  /**
   * Normalize audio level for a track
   */
  function normalizeAudio(trackId: string, targetLevel: number = -3) {
    emit('normalizeAudio', trackId, targetLevel);
    trackRecentAction('normalize-audio', 'Normalize Audio');
  }

  /**
   * Normalize all audio tracks to match levels
   */
  function normalizeAllAudio(targetLevel: number = -3) {
    emit('normalizeAllAudio', targetLevel);
    trackRecentAction('normalize-all', 'Normalize All Audio');
  }

  /**
   * Apply noise reduction to a track
   */
  function applyNoiseReduction(trackId: string, options?: { strength?: number; sensitivity?: number }) {
    const defaultOptions = {
      strength: 0.5, // 0-1 strength of noise reduction
      sensitivity: 0.3, // 0-1 sensitivity to noise detection
    };
    emit('applyNoiseReduction', trackId, { ...defaultOptions, ...options });
    trackRecentAction('noise-reduction', 'Apply Noise Reduction');
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
            const source = props.videoSources.find((s) => s.id === id);
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
    cutHoverInfo.value = null;
  }

  function onPlayheadMouseDown(e: MouseEvent) {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    isDraggingPlayhead.value = true;

    // Initialize optimistic drag time with current position to avoid flicker
    optimisticDragTime.value = props.currentTime;

    // Initialize velocity tracking for inertial scrolling
    playheadVelocity.value = 0;
    lastPlayheadDragTime.value = performance.now();
    lastPlayheadDragX.value = e.clientX;

    // Cancel any ongoing inertial animation
    if (inertialAnimationId) {
      cancelAnimationFrame(inertialAnimationId);
      inertialAnimationId = null;
    }

    // Initialize audio scrubbing if enabled
    if (audioScrubEnabled.value) {
      initAudioScrubbing();
    }

    document.addEventListener('mousemove', onPlayheadDragMove);
    document.addEventListener('mouseup', onPlayheadDragEnd);
  }

  // Auto-scroll configuration for playhead dragging
  const DRAG_SCROLL_EDGE_SIZE = 50; // Pixels from edge to trigger auto-scroll
  const DRAG_SCROLL_SPEED = 8; // Pixels per frame to scroll
  let dragScrollAnimationId: number | null = null;

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

    // Auto-scroll when dragging near edges
    const distanceFromLeft = cursorX - visibleTrackLeft;
    const distanceFromRight = visibleTrackRight - cursorX;

    if (distanceFromLeft < DRAG_SCROLL_EDGE_SIZE && distanceFromLeft > 0) {
      // Near left edge - scroll left
      const scrollAmount = -DRAG_SCROLL_SPEED * (1 - distanceFromLeft / DRAG_SCROLL_EDGE_SIZE);
      scrollContainer.scrollLeft = Math.max(0, scrollContainer.scrollLeft + scrollAmount);
    } else if (distanceFromRight < DRAG_SCROLL_EDGE_SIZE && distanceFromRight > 0) {
      // Near right edge - scroll right
      const scrollAmount = DRAG_SCROLL_SPEED * (1 - distanceFromRight / DRAG_SCROLL_EDGE_SIZE);
      const maxScroll = scrollContainer.scrollWidth - scrollContainer.clientWidth;
      scrollContainer.scrollLeft = Math.min(maxScroll, scrollContainer.scrollLeft + scrollAmount);
    }

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
    let time = clickPositionToTime(percent);

    // Frame-accurate scrubbing: snap to nearest frame when enabled
    if (frameSnapEnabled.value) {
      const frameDuration = 1 / frameRate;
      time = Math.round(time / frameDuration) * frameDuration;
    }

    // Track velocity for inertial scrolling
    const now = performance.now();
    const dt = now - lastPlayheadDragTime.value;
    if (dt > 0 && dt < 100) {
      // Only track if reasonable time delta
      const dx = cursorX - lastPlayheadDragX.value;
      // Convert pixel velocity to time velocity
      const pixelVelocity = dx / dt; // pixels per ms
      const timeVelocity = (pixelVelocity / timelineWidth) * totalDuration.value * 1000; // time units per second
      // Smooth velocity with exponential moving average
      playheadVelocity.value = playheadVelocity.value * 0.7 + timeVelocity * 0.3;
    }
    lastPlayheadDragTime.value = now;
    lastPlayheadDragX.value = cursorX;

    // Play audio scrub preview at the current position
    playScrubAudio(time);

    // Set optimistic drag time BEFORE emitting seek to avoid round-trip lag
    // This ensures the playhead visually follows the cursor immediately
    const clampedTime = Math.max(0, time);
    optimisticDragTime.value = clampedTime;

    emit('seek', clampedTime);
  }

  function onPlayheadDragEnd() {
    isDraggingPlayhead.value = false;

    // Clear optimistic drag time - playhead will now use props.currentTime
    optimisticDragTime.value = null;

    document.removeEventListener('mousemove', onPlayheadDragMove);
    document.removeEventListener('mouseup', onPlayheadDragEnd);

    // Stop audio scrubbing
    stopAudioScrubbing();

    // Reset velocity - disable inertial scrolling as it causes position jumps
    // when dragging between segments in editor mode
    playheadVelocity.value = 0;

    // Cancel any ongoing inertial animation
    if (inertialAnimationId) {
      cancelAnimationFrame(inertialAnimationId);
      inertialAnimationId = null;
    }
  }

  /**
   * Apply inertial scrolling with smooth deceleration
   */
  function applyInertialScrolling(initialVelocity: number) {
    const friction = 0.92; // Deceleration factor (lower = faster stop)
    const minVelocity = 0.1; // Stop when velocity drops below this
    let velocity = initialVelocity;
    let lastTime = performance.now();

    function animate() {
      const now = performance.now();
      const dt = (now - lastTime) / 1000; // Convert to seconds
      lastTime = now;

      // Apply velocity to current time
      const newTime = Math.max(0, Math.min(totalDuration.value, props.currentTime + velocity * dt));
      emit('seek', newTime);

      // Apply friction
      velocity *= friction;

      // Continue animation if velocity is still significant
      if (Math.abs(velocity) > minVelocity && newTime > 0 && newTime < totalDuration.value) {
        inertialAnimationId = requestAnimationFrame(animate);
      } else {
        inertialAnimationId = null;
      }
    }

    inertialAnimationId = requestAnimationFrame(animate);
  }

  /**
   * Initialize audio scrubbing context and load audio buffer from video source
   */
  async function initAudioScrubbing() {
    if (scrubAudioContext) return; // Already initialized

    try {
      scrubAudioContext = new AudioContext();

      // Try to load audio from the video source
      const videoSrc = props.videoSrc || props.videoPath;
      if (!videoSrc) return;

      let audioUrl = videoSrc;

      // Convert local file path to streaming URL if needed
      if (!videoSrc.startsWith('http') && !videoSrc.startsWith('data:')) {
        const port = await invoke<number>('get_video_server_port');
        const encodedPath = btoa(unescape(encodeURIComponent(videoSrc)));
        audioUrl = `http://localhost:${port}/video/${encodedPath}`;
      }

      const response = await fetch(audioUrl);
      const arrayBuffer = await response.arrayBuffer();
      scrubAudioBuffer = await scrubAudioContext.decodeAudioData(arrayBuffer);
      console.log('[AudioScrub] Audio buffer loaded, duration:', scrubAudioBuffer.duration);
    } catch (err) {
      console.warn('[AudioScrub] Failed to initialize audio scrubbing:', err);
      scrubAudioBuffer = null;
    }
  }

  /**
   * Play a short audio snippet at the given time position for scrubbing preview
   */
  function playScrubAudio(time: number) {
    if (!audioScrubEnabled.value || !scrubAudioContext || !scrubAudioBuffer) return;

    // Throttle audio playback to avoid overlapping snippets
    const now = performance.now();
    if (now - lastScrubTime < SCRUB_SNIPPET_DURATION * 800) return; // 80% of snippet duration
    lastScrubTime = now;

    // Stop any currently playing scrub audio
    if (scrubSourceNode) {
      try {
        scrubSourceNode.stop();
      } catch (_e) {
        // Ignore errors from already stopped nodes
      }
      scrubSourceNode = null;
    }

    // Clamp time to valid range
    const startTime = Math.max(0, Math.min(time, scrubAudioBuffer.duration - SCRUB_SNIPPET_DURATION));
    if (startTime < 0 || startTime >= scrubAudioBuffer.duration) return;

    try {
      // Create a new source node for this snippet
      scrubSourceNode = scrubAudioContext.createBufferSource();
      scrubSourceNode.buffer = scrubAudioBuffer;
      scrubSourceNode.connect(scrubAudioContext.destination);

      // Play a short snippet starting at the scrub position
      scrubSourceNode.start(0, startTime, SCRUB_SNIPPET_DURATION);
    } catch (err) {
      console.warn('[AudioScrub] Failed to play scrub audio:', err);
    }
  }

  /**
   * Stop and cleanup audio scrubbing
   */
  function stopAudioScrubbing() {
    if (scrubSourceNode) {
      try {
        scrubSourceNode.stop();
      } catch (_e) {
        // Ignore errors
      }
      scrubSourceNode = null;
    }
  }

  /**
   * Cleanup audio scrubbing context on unmount
   */
  function cleanupAudioScrubbing() {
    stopAudioScrubbing();
    if (scrubAudioContext) {
      scrubAudioContext.close();
      scrubAudioContext = null;
    }
    scrubAudioBuffer = null;
  }

  // Video source functions (editor mode)
  function getVideoSourceStyle(
    source: VideoEditorSource,
    _preview?: { type: ItemType; id: string; startTime: number; endTime: number } | null
  ): Record<string, string> {
    const isSelected = selectedItemKey.value === `source_${source.id}`;

    // Use preview position for both resize AND drag end (to show segment at new position before props update)
    let startTime = source.start_time;
    let endTime = source.end_time;

    // Apply position preview for resize or drag operations
    if (_preview && _preview.type === 'source' && _preview.id === source.id) {
      startTime = _preview.startTime;
      endTime = _preview.endTime;
    }

    // Apply Ripple Shift
    if (rippleState.value && rippleState.value.type === 'source' && source.id !== rippleState.value.id) {
      // Shift if this source starts after the ripple edge
      // Using a small epsilon to catch adjacent clips
      if (source.start_time >= rippleState.value.originalEdgeTime - 0.001) {
        startTime += rippleState.value.delta;
        endTime += rippleState.value.delta;
      }
    }

    // Apply Roll Adjustment
    if (rollState.value && rollState.value.type === 'source') {
      if (source.id === rollState.value.leftItemId && rollState.value.activeHandle === 'left') {
        // We are dragging the right item's left handle, so left item's end needs to follow
        endTime = rollState.value.newRollTime;
      } else if (source.id === rollState.value.rightItemId && rollState.value.activeHandle === 'right') {
        // We are dragging the left item's right handle, so right item's start needs to follow
        startTime = rollState.value.newRollTime;
      }
    }

    // Apply Slide Adjustment (Visual) - slide tool uses ghost element
    if (slideState.value && slideState.value.type === 'source') {
      if (source.id === slideState.value.leftNeighborId) {
        // Left neighbor end changes
        endTime += slideState.value.delta;
      } else if (source.id === slideState.value.rightNeighborId) {
        // Right neighbor start changes
        startTime += slideState.value.delta;
      }
    }

    const duration = totalDuration.value || props.duration || 300;
    const leftPercent = (startTime / duration) * 100;
    const widthPercent = ((endTime - startTime) / duration) * 100;

    // Check if this source is being dragged - hide completely so ghost is the only visual
    const isDraggingThis = isDraggingSource.value && dragSourceInfo.value?.sourceId === source.id;

    return {
      left: `${leftPercent}%`,
      width: `${widthPercent}%`,
      borderColor: isSelected ? '#06b6d4' : 'transparent', // Cyan-500
      opacity: isDraggingThis ? '0' : '1',
      pointerEvents: isDraggingThis ? 'none' : 'auto',
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
    // Select the source (with multi-select support via modifier keys)
    selectItem('source', source.id);

    // Emit multi-select event with modifier keys for parent to handle
    emit('sourceSelect', source.id, {
      shift: e.shiftKey,
      ctrl: e.ctrlKey || e.metaKey,
    });

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

    // Prevent editing if track is locked
    if (videoTrackState.isLocked) {
      return;
    }

    e.preventDefault();

    selectItem('source', source.id);

    // Capture the clicked element's position for ghost
    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();

    // Initialize ghost state and position
    dragGhostState.value = {
      visible: true,
      type: 'source',
      id: source.id,
      initialLeft: rect.left,
      initialTop: rect.top,
      width: rect.width,
      height: rect.height,
      label: source.source_name || 'Video',
      color: 'cyan',
    };

    // Reset ghost transform
    if (dragGhostRef.value) {
      dragGhostRef.value.style.transform = 'translateX(0px)';
    }

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
    const deltaY = e.clientY - dragSourceInfo.value.startY;
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

    // Apply snapping for video sources - optional snap within threshold for all tracks
    // Both Source track (track_index 0) and Layers use the same threshold-based snapping
    const snapResult = applySnapToSegment(newStartTime, newEndTime, dragSourceInfo.value.sourceId);
    if (snapResult.didSnap) {
      newStartTime = snapResult.startTime;
      newEndTime = snapResult.endTime;
      activeSnapTime.value = snapResult.snapTime;
      activeSnapTrackType.value = snapResult.snapTrackType;
    } else {
      activeSnapTime.value = null;
      activeSnapTrackType.value = null;
    }

    // Calculate snap-adjusted deltaX for visual transform
    const snapDelta = newStartTime - dragSourceInfo.value.originalStartTime;
    const snapAdjustedDeltaX = (snapDelta / props.duration) * rect.width;

    // Store the snap-adjusted delta for onSourceDragEnd
    dragSourceInfo.value.currentDeltaX = snapAdjustedDeltaX;

    // DIRECT DOM MANIPULATION - bypasses Vue reactivity completely for zero-lag dragging
    // Only horizontal movement - segments stay within their track
    if (dragGhostRef.value) {
      dragGhostRef.value.style.transform = `translateX(${snapAdjustedDeltaX}px)`;
    }
  }

  function onSourceDragEnd() {
    // Remove event listeners immediately to prevent further drag events
    document.removeEventListener('mousemove', onSourceDragMove);
    document.removeEventListener('mouseup', onSourceDragEnd);

    // Commit the final position to database only on drag end
    if (dragSourceInfo.value && videoTrackContentRef.value) {
      const rect = videoTrackContentRef.value.getBoundingClientRect();
      const deltaX = dragSourceInfo.value.currentDeltaX ?? 0;
      const deltaTime = (deltaX / rect.width) * props.duration;
      const duration = dragSourceInfo.value.originalEndTime - dragSourceInfo.value.originalStartTime;

      let finalStartTime = dragSourceInfo.value.originalStartTime + deltaTime;
      let finalEndTime = finalStartTime + duration;

      // Clamp to timeline bounds
      if (finalStartTime < 0) {
        finalStartTime = 0;
        finalEndTime = duration;
      }
      if (finalEndTime > props.duration) {
        finalEndTime = props.duration;
        finalStartTime = props.duration - duration;
      }

      // Set dragPreview to final position BEFORE emitting and clearing isDraggingSource
      // This ensures the segment renders at the new position immediately while props update
      dragPreview.value = {
        type: 'source',
        id: dragSourceInfo.value.sourceId,
        startTime: finalStartTime,
        endTime: finalEndTime,
      };

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

    // Hide ghost immediately, but keep dragPreview set so segment shows at new position
    dragGhostState.value = null;
    isDraggingSource.value = false;
    dragSourceInfo.value = null;
    activeSnapTime.value = null;
    activeSnapTrackType.value = null;

    // Clear dragPreview after a delay to allow props to propagate from parent
    setTimeout(() => {
      dragPreview.value = null;
    }, 100);
  }

  // Segment context menu state (for Clip Mode)
  const segmentContextMenu = reactive({
    visible: false,
    x: 0,
    y: 0,
    segment: null as TrimSegment | null,
  });

  function onSegmentContextMenu(e: MouseEvent, segment: TrimSegment) {
    segmentContextMenu.visible = true;
    segmentContextMenu.x = e.clientX;
    segmentContextMenu.y = e.clientY;
    segmentContextMenu.segment = segment;
  }

  function closeSegmentContextMenu() {
    segmentContextMenu.visible = false;
    segmentContextMenu.segment = null;
  }

  async function extractAudioFromSegment() {
    if (!segmentContextMenu.segment || !props.videoPath) return;

    const segment = segmentContextMenu.segment;
    closeSegmentContextMenu();

    isExtractingAudio.value = true;

    // Show loading toast
    const loadingToastId = toastLoading('Extracting Audio', 'Processing segment');

    try {
      console.log('[ClipEditorTimeline] Extracting audio from segment:', segment.id);

      // Calculate the trim parameters based on the segment's position relative to clip start
      // segment.startTime is relative to clipStart
      // So absolute start time in video = props.clipStart + segment.startTime
      const trimStart = props.clipStart + segment.startTime;
      const segmentDuration = segment.endTime - segment.startTime;

      console.log('[ClipEditorTimeline] Extraction params:', {
        clipStart: props.clipStart,
        segmentStartTime: segment.startTime,
        calculatedTrimStart: trimStart,
        segmentDuration,
      });

      // Call Rust command to extract audio
      const result = await invoke<{ file_path: string; filename: string; duration: number }>('extract_audio_to_file', {
        videoPath: props.videoPath,
        sourceId: 'main', // Use generic ID for clip mode
        trimStart: trimStart,
        trimDuration: segmentDuration,
      });

      console.log('[ClipEditorTimeline] Audio extraction complete:', result);

      // Audio track should start at the segment's start time on the timeline
      const audioStartTime = segment.startTime;
      const audioEndTime = audioStartTime + result.duration;

      emit('extractedAudio', {
        sourceId: 'main',
        filePath: result.file_path,
        filename: result.filename,
        duration: result.duration,
        startTime: audioStartTime,
        endTime: audioEndTime,
        sourceName: 'Extracted Audio',
      });

      // Remove loading toast and show success
      removeToast(loadingToastId);
      toastSuccess('Audio Extracted', 'Audio track added to timeline');
    } catch (error) {
      console.error('[ClipEditorTimeline] Failed to extract audio:', error);
      // Remove loading toast and show error
      removeToast(loadingToastId);
      toastError('Extraction Failed', error instanceof Error ? error.message : 'Failed to extract audio');
    } finally {
      isExtractingAudio.value = false;
    }
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

    // Show loading toast
    const loadingToastId = toastLoading('Extracting Audio', `Processing "${source.source_name || 'video'}"`);

    try {
      console.log('[ClipEditorTimeline] Extracting audio from source:', source.id);

      // Calculate the trim parameters based on the segment's trim settings
      // trim_start is how far into the source video to start
      // The segment duration is (end_time - start_time) on the timeline
      const trimStart = source.trim_start ?? 0;
      const segmentDuration = source.end_time - source.start_time;

      console.log('[ClipEditorTimeline] Extraction params:', {
        sourceTrimStart: source.trim_start,
        sourceTrimEnd: source.trim_end,
        calculatedTrimStart: trimStart,
        segmentDuration,
        sourceStartTime: source.start_time,
        sourceEndTime: source.end_time,
        sourceDuration: source.source_duration,
      });

      // Call Rust command to extract audio from the specific segment
      // Tauri expects camelCase params which it converts to snake_case for Rust
      console.log('[ClipEditorTimeline] Invoking extract_audio_to_file with:', {
        videoPath: source.source_path,
        sourceId: source.id,
        trimStart: trimStart,
        trimDuration: segmentDuration,
      });

      const result = await invoke<{ file_path: string; filename: string; duration: number }>('extract_audio_to_file', {
        videoPath: source.source_path,
        sourceId: source.id,
        trimStart: trimStart,
        trimDuration: segmentDuration,
      });

      console.log('[ClipEditorTimeline] Audio extraction complete:', result);

      // Emit event to create audio track with the extracted audio
      // The audio track should start at the same position as the video source on the timeline
      // Use the actual extracted audio duration for the end time to ensure perfect alignment
      const audioEndTime = source.start_time + result.duration;

      console.log('[ClipEditorTimeline] Audio track positioning:', {
        sourceStartTime: source.start_time,
        sourceEndTime: source.end_time,
        extractedDuration: result.duration,
        calculatedAudioEndTime: audioEndTime,
      });

      emit('extractedAudio', {
        sourceId: source.id,
        filePath: result.file_path,
        filename: result.filename,
        duration: result.duration,
        startTime: source.start_time,
        endTime: audioEndTime,
        sourceName: source.source_name,
      });

      // Remove loading toast and show success
      removeToast(loadingToastId);
      toastSuccess('Audio Extracted', 'Audio track added to timeline');
    } catch (error) {
      console.error('[ClipEditorTimeline] Failed to extract audio:', error);
      // Remove loading toast and show error
      removeToast(loadingToastId);
      toastError('Extraction Failed', error instanceof Error ? error.message : 'Failed to extract audio');
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

  // J/L Cut functions
  function hasAudioOffset(source: VideoEditorSource | null): boolean {
    if (!source) return false;
    return (
      (source.audio_trim_start !== undefined && source.audio_trim_start !== null) ||
      (source.audio_trim_end !== undefined && source.audio_trim_end !== null)
    );
  }

  function applyJCut() {
    if (!sourceContextMenu.source) return;

    const source = sourceContextMenu.source;
    closeSourceContextMenu();

    // J-cut: Audio from this clip starts 0.5s earlier than video
    // This means audio_trim_start is less than trim_start
    const jCutOffset = 0.5; // Default 0.5 second audio lead
    const newAudioTrimStart = Math.max(0, (source.trim_start || 0) - jCutOffset);

    emit('updateSource', source.id, {
      audio_trim_start: newAudioTrimStart,
      audio_trim_end: source.trim_end, // Keep video trim end for audio
    });
  }

  function applyLCut() {
    if (!sourceContextMenu.source) return;

    const source = sourceContextMenu.source;
    closeSourceContextMenu();

    // L-cut: Audio from this clip extends 0.5s beyond video
    // This means audio_trim_end is greater than trim_end
    const lCutOffset = 0.5; // Default 0.5 second audio extension
    const sourceDuration = source.source_duration || source.end_time - source.start_time;
    const currentTrimEnd = source.trim_end ?? sourceDuration;
    const newAudioTrimEnd = Math.min(sourceDuration, currentTrimEnd + lCutOffset);

    emit('updateSource', source.id, {
      audio_trim_start: source.trim_start, // Keep video trim start for audio
      audio_trim_end: newAudioTrimEnd,
    });
  }

  function resetAudioTrim() {
    if (!sourceContextMenu.source) return;

    const source = sourceContextMenu.source;
    closeSourceContextMenu();

    // Reset audio trim to match video trim (sync audio with video)
    emit('updateSource', source.id, {
      audio_trim_start: null,
      audio_trim_end: null,
    });
  }

  /**
   * Add a freeze frame at the current playhead position
   * Creates a still image segment from the current video frame
   */
  // Thumbnail cache for filmstrip thumbnails (sourceId -> cached thumbnail data)
  const thumbnailCache = ref<
    Map<string, { thumbnails: { width: number; bgPosition: number }[]; zoomLevel: number; containerWidth: number }>
  >(new Map());

  // Thumbnail loading state (sourceId -> loading status)
  const thumbnailLoadingState = ref<Map<string, boolean>>(new Map());

  /**
   * Get adaptive thumbnail density based on zoom level
   * Higher zoom = more thumbnails for detail, lower zoom = fewer for performance
   */
  function getAdaptiveThumbnailWidth(): number {
    const baseWidth = 60;
    if (zoomLevel.value < 1) return baseWidth * 1.5; // Fewer thumbnails when zoomed out
    if (zoomLevel.value < 2) return baseWidth;
    if (zoomLevel.value < 5) return baseWidth * 0.8; // More thumbnails when zoomed in
    return baseWidth * 0.6; // Maximum density at high zoom
  }

  /**
   * Check if thumbnail is loading for a source
   */
  function isThumbnailLoading(sourceId: string): boolean {
    return thumbnailLoadingState.value.get(sourceId) ?? false;
  }

  /**
   * Generate filmstrip thumbnail positions for a video source
   * Uses caching and adaptive density based on zoom level
   * PERFORMANCE: Caps maximum thumbnails to prevent DOM bloat at high zoom
   */
  function getFilmstripThumbnails(source: VideoEditorSource): { width: number; bgPosition: number }[] {
    const THUMB_WIDTH = getAdaptiveThumbnailWidth(); // Adaptive density based on zoom
    const MAX_THUMBNAILS = 50; // Cap to prevent performance issues at high zoom
    const duration = source.end_time - source.start_time;
    const totalDur = props.editorMode ? props.duration : totalDuration.value;

    if (totalDur <= 0 || duration <= 0) return [];

    // Calculate the pixel width of this source segment
    const segmentWidthPercent = (duration / totalDur) * 100;
    const containerWidth = contentWrapperRef.value?.offsetWidth || 1000;
    const segmentWidth = (segmentWidthPercent / 100) * containerWidth * zoomLevel.value;

    // Check cache - invalidate if zoom level or container width changed significantly
    const cacheKey = source.id;
    const cached = thumbnailCache.value.get(cacheKey);
    if (
      cached &&
      Math.abs(cached.zoomLevel - zoomLevel.value) < 0.1 &&
      Math.abs(cached.containerWidth - containerWidth) < 50
    ) {
      return cached.thumbnails;
    }

    // Calculate number of thumbnails needed - CAPPED for performance
    const rawNumThumbs = Math.max(1, Math.ceil(segmentWidth / THUMB_WIDTH));
    const numThumbs = Math.min(rawNumThumbs, MAX_THUMBNAILS);
    const actualThumbWidth = segmentWidth / numThumbs;

    // Generate thumbnail data
    const thumbnails: { width: number; bgPosition: number }[] = [];
    const sourceDuration = source.source_duration || duration;
    const trimStart = source.trim_start || 0;

    for (let i = 0; i < numThumbs; i++) {
      // Calculate the time position within the source for this thumbnail
      const timeOffset = (i / numThumbs) * duration;
      const sourceTime = trimStart + timeOffset;
      // Convert to percentage position in the thumbnail image (0-100)
      const bgPosition = sourceDuration > 0 ? (sourceTime / sourceDuration) * 100 : 0;

      thumbnails.push({
        width: actualThumbWidth,
        bgPosition: Math.min(100, Math.max(0, bgPosition)),
      });
    }

    // Cache the result
    thumbnailCache.value.set(cacheKey, {
      thumbnails,
      zoomLevel: zoomLevel.value,
      containerWidth,
    });

    return thumbnails;
  }

  /**
   * Get the speed of a video source (defaults to 1.0)
   */
  function getSourceSpeed(source: VideoEditorSource | null): number {
    return source?.speed ?? 1;
  }

  /**
   * Set the playback speed of the currently selected source
   */
  function setSourceSpeed(speed: number) {
    if (!sourceContextMenu.source) return;

    const source = sourceContextMenu.source;
    closeSourceContextMenu();

    // Emit update to change the source speed
    emit('updateSource', source.id, { speed });
  }

  /**
   * Open the speed curve editor for the currently selected source
   */
  function openSpeedCurveEditor() {
    if (!sourceContextMenu.source) return;

    const source = sourceContextMenu.source;
    closeSourceContextMenu();

    // Emit event to open speed curve editor in parent component
    emit('openSpeedCurveEditor', source.id);
  }

  function addFreezeFrame() {
    if (!sourceContextMenu.source) return;

    const source = sourceContextMenu.source;
    closeSourceContextMenu();

    // Calculate the time within the source where the playhead is
    const playheadTime = props.currentTime;

    // Check if playhead is within this source's time range
    if (playheadTime < source.start_time || playheadTime > source.end_time) {
      // Playhead is not within this source - use the source's start time
      const sourceTime = source.trim_start ?? 0;
      emit('freezeFrame', {
        sourceId: source.id,
        time: sourceTime,
        duration: 2.0, // Default 2 second freeze frame
      });
    } else {
      // Calculate the corresponding time in the source video
      const offsetInTimeline = playheadTime - source.start_time;
      const sourceTime = (source.trim_start ?? 0) + offsetInTimeline;

      emit('freezeFrame', {
        sourceId: source.id,
        time: sourceTime,
        duration: 2.0, // Default 2 second freeze frame
      });
    }
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

    if (!timelineScrollContainer.value || !contentWrapperRef.value) return;

    const scrollContainer = timelineScrollContainer.value;
    const contentWrapper = contentWrapperRef.value;
    const containerRect = scrollContainer.getBoundingClientRect();

    // Get content wrapper bounds to calculate hover position for seeking
    // Use contentWrapperRef for consistency with playhead position calculation
    const wrapperRect = contentWrapper.getBoundingClientRect();
    const cursorXInWrapper = event.clientX - wrapperRect.left;

    // Account for the 120px track label area
    const contentAreaX = cursorXInWrapper - TRACK_LABEL_WIDTH;
    const contentAreaWidth = wrapperRect.width - TRACK_LABEL_WIDTH;

    // Detect pinch-to-zoom gesture (trackpad pinch sets ctrlKey)
    const isPinchGesture = event.ctrlKey;

    // For regular scroll (not pinch), seek playhead to cursor position
    if (!isPinchGesture && contentAreaX >= 0 && contentAreaX <= contentAreaWidth) {
      const percent = contentAreaX / contentAreaWidth;
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

    // For pinch gestures, use deltaY directly for smoother zoom
    // Pinch out (spread fingers) = negative deltaY = zoom in
    // Pinch in (pinch fingers) = positive deltaY = zoom out
    let delta: number;
    if (isPinchGesture) {
      // Pinch gesture: use smaller, smoother steps
      delta = -event.deltaY * 0.01; // Invert and scale for natural pinch behavior
    } else {
      // Regular scroll wheel
      delta = event.deltaY > 0 ? -step : step;
    }

    const newZoom = Math.max(MIN_ZOOM.value, oldZoom + delta);

    if (newZoom === oldZoom) return;

    // Use batched zoom update via requestAnimationFrame for performance
    queueZoomUpdate(newZoom, logicalPosition, cursorXInContainer, scrollContainer);
  }

  /**
   * Handle wheel events on the timeline container for pinch-to-zoom
   * This allows pinch gestures anywhere on the timeline, not just the ruler
   */
  function onTimelineWheel(event: WheelEvent) {
    // Only handle pinch-to-zoom gestures (ctrlKey is set by trackpad pinch)
    if (!event.ctrlKey) return;

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

    // Apply zoom - pinch out = zoom in, pinch in = zoom out
    const oldZoom = zoomLevel.value;
    const delta = -event.deltaY * 0.01; // Invert and scale for natural pinch behavior
    const newZoom = Math.max(MIN_ZOOM.value, oldZoom + delta);

    if (newZoom === oldZoom) return;

    // Use batched zoom update via requestAnimationFrame for performance
    queueZoomUpdate(newZoom, logicalPosition, cursorXInContainer, scrollContainer);
  }

  // Segment dragging
  function onSegmentMouseDown(e: MouseEvent, type: ItemType, id: string, item: any) {
    if (e.button !== 0) return;

    // Check if track is locked - prevent editing
    if (type === 'trim' || type === 'source') {
      if (videoTrackState.isLocked) return;
    } else if (type === 'audio') {
      // Check if this specific audio track is locked
      const audioTrack = props.audioTracks.find((t) => t.id === id);
      if (audioTrack?.isLocked) return;
    }

    e.preventDefault();
    e.stopPropagation();

    const trackContentWidth = getTrackContentWidth();
    const originalLayer = ['text', 'sticker', 'watermark'].includes(type) ? (item.layer ?? 0) : undefined;
    const originalTrackIndex = type === 'source' ? (item.track_index ?? 0) : undefined;

    // Capture the clicked element's position for ghost
    const targetEl = e.currentTarget as HTMLElement;
    const rect = targetEl.getBoundingClientRect();

    // Determine color based on type
    const colorMap: Record<string, string> = {
      trim: 'violet',
      source: 'cyan',
      audio: 'emerald',
      text: 'amber',
      sticker: 'rose',
      watermark: 'violet',
      effect: 'cyan',
      filter: 'rose',
    };

    // Get label for ghost
    let label = '';
    if (type === 'audio') label = item.name || 'Audio';
    else if (type === 'text') label = item.text?.substring(0, 20) || 'Text';
    else if (type === 'source') label = item.source_name || 'Video';
    else if (type === 'trim') label = 'Segment';
    else label = type.charAt(0).toUpperCase() + type.slice(1);

    // Initialize ghost state and position
    dragGhostState.value = {
      visible: true,
      type,
      id,
      initialLeft: rect.left,
      initialTop: rect.top,
      width: rect.width,
      height: rect.height,
      label,
      color: colorMap[type] || 'violet',
    };

    // Reset ghost transform
    if (dragGhostRef.value) {
      dragGhostRef.value.style.transform = 'translateX(0px)';
    }

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

    // For audio tracks, detect which track row the mouse is over
    if (dragInfo.value.type === 'audio' && dragInfo.value.originalTrackOrder !== undefined) {
      // Calculate which audio track the mouse is currently over based on vertical position
      const TRACK_HEIGHT = 48; // 12 * 4px (h-12 in Tailwind)
      const trackOffset = Math.round(deltaY / TRACK_HEIGHT);
      const targetTrackOrder = dragInfo.value.originalTrackOrder + trackOffset;

      // Clamp to valid track range
      const maxTrackOrder = Math.max(...props.audioTracks.map((t) => t.trackOrder));
      const minTrackOrder = Math.min(...props.audioTracks.map((t) => t.trackOrder));
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

    // SLIP TOOL LOGIC
    if (isSlipTool.value && dragInfo.value.type === 'source') {
      const item = dragInfo.value.item as VideoEditorSource;
      const deltaX = e.clientX - dragInfo.value.startX;
      // Slip delta is inverted: dragging right slips content left (earlier in source), so we subtract delta
      // But typically dragging content: drag right -> see earlier content -> start_time decreases.
      // Wait, standard NLE:
      // Drag rect right -> clip stays, content moves right? No, usually "Slip" moves the "window" over the content.
      // Dragging right: Window moves right relative to content?
      // Let's stick to: Drag right -> delta positive.
      // Content time = Time - start + trim_start.
      // If we slip by +delta (right):
      // new_trim_start = old_trim_start - delta?
      // Let's visualize:
      // [   Source Content   ]
      //     [ Segment ]
      // Drag Segment Mouse Right -> We want to see "earlier" content?
      // Usually, dragging the clip visual representation with slip tool:
      // Drag Right -> The content shifts right. Meaning we see earlier frames at the start.
      // So trim_start decreases.
      // So delta is negative of drag delta?
      // Let's use: delta = -(pixelDelta / pixelsPerSecond).

      const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * props.duration;
      const slipDelta = -deltaTime;

      slipState.value = {
        type: 'source',
        id: dragInfo.value.id,
        delta: slipDelta,
        originalTrimStart: item.trim_start,
        originalTrimEnd: item.trim_end,
      };

      // Position doesn't change for slip
      return;
    }

    // SLIDE TOOL LOGIC
    if (isSlideTool.value && dragInfo.value.type === 'source' && props.videoSources) {
      const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * props.duration;

      // Identify neighbors
      // This relies on sorting.
      const sortedSources = [...props.videoSources].sort((a, b) => a.start_time - b.start_time);
      const currentIndex = sortedSources.findIndex((s) => s.id === dragInfo.value?.id);

      let leftNeighborId = '';
      let rightNeighborId = '';

      if (currentIndex > 0) leftNeighborId = sortedSources[currentIndex - 1].id;
      if (currentIndex < sortedSources.length - 1) rightNeighborId = sortedSources[currentIndex + 1].id;

      if (leftNeighborId && rightNeighborId) {
        slideState.value = {
          type: 'source',
          id: dragInfo.value.id,
          leftNeighborId,
          rightNeighborId,
          delta: deltaTime,
          originalStartTime: dragInfo.value.originalStartTime,
          originalEndTime: dragInfo.value.originalEndTime,
        };

        // DIRECT DOM MANIPULATION - bypasses Vue reactivity for smooth dragging
        // Only horizontal movement - segments stay within their track
        if (dragGhostRef.value) {
          dragGhostRef.value.style.transform = `translateX(${deltaX}px)`;
        }
        return;
      }
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

    // Calculate snapped position for snap line indicator (but don't update dragPreview)
    let newStartTime: number;
    let newEndTime: number;
    let snapAdjustedDeltaX = deltaX;

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

      // Apply snapping for trim segments - calculate snap for visual feedback
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
        activeSnapTrackType.value = snapResult.snapTrackType;
        // Adjust visual deltaX to account for snap
        const snapDelta = newStartTime - dragInfo.value.originalStartTime;
        snapAdjustedDeltaX = (snapDelta / props.duration) * dragInfo.value.trackContentWidth;
      } else {
        activeSnapTime.value = null;
        activeSnapTrackType.value = null;
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
        activeSnapTrackType.value = snapResult.snapTrackType;
        // Adjust visual deltaX to account for snap
        const snapDelta = newStartTime - dragInfo.value.originalStartTime;
        snapAdjustedDeltaX = (snapDelta / totalDuration.value) * dragInfo.value.trackContentWidth;
      } else {
        activeSnapTime.value = null;
        activeSnapTrackType.value = null;
      }
    } else {
      // For text, sticker, effect, filter - CapCut-style free positioning
      // These overlay items can extend beyond the source video duration
      const deltaPercent = (deltaX / dragInfo.value.trackContentWidth) * 100;
      // Calculate original visual position and new visual position
      const originalStartPercent = effectiveTimeToVisualPercent(dragInfo.value.originalStartTime);
      const newStartPercent = Math.max(0, originalStartPercent + deltaPercent);

      // Convert new visual position back to effective time
      newStartTime = visualPercentToEffectiveTime(newStartPercent);
      newEndTime = newStartTime + itemDuration;

      // Only constrain to not go before 0 - NO upper bound constraint (CapCut-style)
      if (newStartTime < 0) {
        newStartTime = 0;
        newEndTime = itemDuration;
      }
      // Note: No upper bound - items can extend beyond source duration
      // The totalDuration computed will automatically grow to accommodate

      // Apply snapping for overlay items
      const snapResult = applySnapToSegment(newStartTime, newEndTime, dragInfo.value.id);
      if (snapResult.didSnap) {
        if (snapResult.startTime >= 0) {
          newStartTime = snapResult.startTime;
          newEndTime = snapResult.endTime;
        }
        activeSnapTime.value = snapResult.snapTime;
        activeSnapTrackType.value = snapResult.snapTrackType;
        // Adjust visual deltaX to account for snap
        const snappedPercent = effectiveTimeToVisualPercent(newStartTime);
        const originalPercent = effectiveTimeToVisualPercent(dragInfo.value.originalStartTime);
        snapAdjustedDeltaX = ((snappedPercent - originalPercent) / 100) * dragInfo.value.trackContentWidth;
      } else {
        activeSnapTime.value = null;
        activeSnapTrackType.value = null;
      }
    }

    // Store the final delta for use in onDragEnd (minimal reactive update)
    dragInfo.value.currentDeltaX = snapAdjustedDeltaX;
    dragInfo.value.currentDeltaY = deltaY;

    // DIRECT DOM MANIPULATION - bypasses Vue reactivity completely for zero-lag dragging
    // Only horizontal movement - segments stay within their track
    if (dragGhostRef.value) {
      dragGhostRef.value.style.transform = `translateX(${snapAdjustedDeltaX}px)`;
    }
  }

  function onDragEnd() {
    // Remove event listeners immediately to prevent further drag events
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', onDragEnd);

    // Commit the final position to database with undo/redo support
    if (dragInfo.value) {
      // Handle Slip Edit End
      if (isSlipTool.value && slipState.value) {
        emit('slipEdit', {
          type: slipState.value.type,
          itemId: slipState.value.id,
          delta: slipState.value.delta,
          originalTrimStart: slipState.value.originalTrimStart,
          originalTrimEnd: slipState.value.originalTrimEnd,
        });

        // Delay cleanup until Vue has processed the update
        nextTick(() => {
          isDragging.value = false;
          dragInfo.value = null;
          slipState.value = null;
          dragGhostState.value = null;
          debouncedRenderAllWaveforms();
        });
        return;
      }

      // Handle Slide Edit End
      if (isSlideTool.value && slideState.value) {
        emit('slideEdit', {
          type: slideState.value.type,
          itemId: slideState.value.id,
          leftNeighborId: slideState.value.leftNeighborId,
          rightNeighborId: slideState.value.rightNeighborId,
          delta: slideState.value.delta,
          originalStartTime: slideState.value.originalStartTime,
          originalEndTime: slideState.value.originalEndTime,
        });

        // Delay cleanup until Vue has processed the update
        nextTick(() => {
          isDragging.value = false;
          dragInfo.value = null;
          slideState.value = null;
          dragGhostState.value = null;
          debouncedRenderAllWaveforms();
        });
        return;
      }

      // Compute final position from stored delta
      const deltaX = dragInfo.value.currentDeltaX ?? 0;
      if (
        deltaX !== 0 ||
        dragInfo.value.targetTrackOrder !== dragInfo.value.originalTrackOrder ||
        dragInfo.value.targetLayer !== dragInfo.value.originalLayer ||
        dragInfo.value.targetTrackIndex !== dragInfo.value.originalTrackIndex
      ) {
        const type = dragInfo.value.type;
        const id = dragInfo.value.id;
        const itemDuration = dragInfo.value.originalEndTime - dragInfo.value.originalStartTime;

        let newStartTime: number;
        let newEndTime: number;

        // Calculate final time based on item type
        if (type === 'trim') {
          const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * props.duration;
          newStartTime = dragInfo.value.originalStartTime + deltaTime;
          newEndTime = newStartTime + itemDuration;

          // Clamp to bounds
          if (newStartTime < 0) {
            newStartTime = 0;
            newEndTime = itemDuration;
          }
          if (newEndTime > props.duration) {
            newEndTime = props.duration;
            newStartTime = props.duration - itemDuration;
          }
        } else if (type === 'audio') {
          const deltaTime = (deltaX / dragInfo.value.trackContentWidth) * totalDuration.value;
          newStartTime = dragInfo.value.originalStartTime + deltaTime;
          newEndTime = newStartTime + itemDuration;

          if (newStartTime < 0) {
            newStartTime = 0;
            newEndTime = itemDuration;
          }
        } else {
          // For text, sticker, effect, filter, source - CapCut-style free positioning
          const deltaPercent = (deltaX / dragInfo.value.trackContentWidth) * 100;
          const originalStartPercent = effectiveTimeToVisualPercent(dragInfo.value.originalStartTime);
          const newStartPercent = Math.max(0, originalStartPercent + deltaPercent);

          newStartTime = visualPercentToEffectiveTime(newStartPercent);
          newEndTime = newStartTime + itemDuration;

          if (newStartTime < 0) {
            newStartTime = 0;
            newEndTime = itemDuration;
          }
        }

        // Set dragPreview to final position BEFORE emitting and clearing isDragging
        // This ensures the segment renders at the new position immediately while props update
        dragPreview.value = {
          type,
          id,
          startTime: newStartTime,
          endTime: newEndTime,
        };

        // For video sources with cross-track dragging
        if (
          type === 'source' &&
          dragInfo.value.targetTrackIndex !== undefined &&
          dragInfo.value.targetTrackIndex !== dragInfo.value.originalTrackIndex
        ) {
          // Video source was dragged to a different track
          emit('updateSource', id, {
            start_time: newStartTime,
            end_time: newEndTime,
            track_index: dragInfo.value.targetTrackIndex,
          });
        } else if (
          type === 'audio' &&
          dragInfo.value.targetTrackOrder !== undefined &&
          dragInfo.value.targetTrackOrder !== dragInfo.value.originalTrackOrder
        ) {
          // Audio was dragged to a different track
          emit('updateAudioTrack', id, {
            startTime: newStartTime,
            endTime: newEndTime,
            trackOrder: dragInfo.value.targetTrackOrder,
          });
        } else if (['text', 'sticker', 'watermark'].includes(type)) {
          // Visual overlays always use direct update to preserve layer property
          const currentLayer = dragInfo.value.targetLayer ?? dragInfo.value.originalLayer ?? 0;
          const updateData: any = {
            startTime: newStartTime,
            endTime: newEndTime,
            layer: currentLayer,
          };

          if (type === 'text') {
            emit('updateTextOverlay', id, updateData);
          } else if (type === 'sticker') {
            emit('updateSticker', id, updateData);
          } else if (type === 'watermark') {
            emit('updateWatermark', id, updateData);
          }
        } else if (['effect', 'audio', 'filter'].includes(type)) {
          // For track types that support undo/redo, emit moveTrack event
          emit('moveTrack', {
            type,
            id,
            originalStartTime: dragInfo.value.originalStartTime,
            originalEndTime: dragInfo.value.originalEndTime,
            newStartTime,
            newEndTime,
          });
        } else {
          // For other types (trim, source), use direct update
          emitUpdate(type, id, newStartTime, newEndTime);
        }
      }
    }

    // Hide ghost immediately, but keep dragPreview set so segment shows at new position
    dragGhostState.value = null;
    isDragging.value = false;
    dragInfo.value = null;
    activeSnapTime.value = null;
    activeSnapTrackType.value = null;

    // Clear dragPreview after a delay to allow props to propagate from parent
    setTimeout(() => {
      dragPreview.value = null;
      debouncedRenderAllWaveforms();
    }, 100);
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
    let newTrimStart: number | undefined;
    let newTrimEnd: number | undefined;

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
          activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }
      } else {
        newEndTime = Math.min(props.duration, resizeInfo.value.originalEndTime + deltaTime);

        // Apply snapping to the right edge
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time <= props.duration) {
          newEndTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
          activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
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
          activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }
      } else {
        newEndTime = resizeInfo.value.originalEndTime + deltaTime;

        // Apply snapping to the right edge
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap) {
          newEndTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
          activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }
      }
    } else if (resizeInfo.value.type === 'source') {
      const source = resizeInfo.value.item;
      const deltaX = e.clientX - resizeInfo.value.startX;
      const deltaTime = (deltaX / resizeInfo.value.trackContentWidth) * props.duration;
      const originalTrimStart = source.trim_start ?? 0;
      const originalTrimEnd = source.trim_end ?? originalTrimStart + (source.end_time - source.start_time);
      const sourceDuration = source.source_duration || Infinity;

      if (resizeInfo.value.handle === 'left') {
        newStartTime = Math.max(0, resizeInfo.value.originalStartTime + deltaTime);
        newTrimStart = originalTrimStart + (newStartTime - resizeInfo.value.originalStartTime);

        // Constrain trim_start >= 0
        if (newTrimStart !== undefined && newTrimStart < 0) {
          newTrimStart = 0;
          newStartTime = resizeInfo.value.originalStartTime - originalTrimStart;
        }

        // Apply snapping to the left edge
        const snapResult = applySnapToTime(newStartTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time >= 0) {
          const snappedDelta = snapResult.time - resizeInfo.value.originalStartTime;
          const snappedTrimStart = originalTrimStart + snappedDelta;

          if (snappedTrimStart >= 0) {
            newStartTime = snapResult.time;
            newTrimStart = snappedTrimStart;
            activeSnapTime.value = snapResult.time;
            activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
          } else {
            activeSnapTime.value = null;
            activeSnapTrackType.value = null;
          }
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        // Min duration check
        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          newTrimStart = originalTrimStart + (newStartTime - resizeInfo.value.originalStartTime);
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        newTrimEnd = originalTrimEnd;
      } else {
        // Right handle
        newEndTime = Math.min(props.duration, resizeInfo.value.originalEndTime + deltaTime);
        // Calculate newTrimEnd
        const baseTrimEnd = originalTrimEnd ?? sourceDuration;
        newTrimEnd = baseTrimEnd + (newEndTime - resizeInfo.value.originalEndTime);

        // Constrain trim_end <= sourceDuration
        if (newTrimEnd !== undefined && newTrimEnd > sourceDuration) {
          newTrimEnd = sourceDuration;
          newEndTime = resizeInfo.value.originalEndTime + (sourceDuration - baseTrimEnd);
        }

        // Apply snapping to the right edge
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap && snapResult.time <= props.duration) {
          const snappedDelta = snapResult.time - resizeInfo.value.originalEndTime;
          // Ensure we have a valid base for snapped calculation
          const baseTrimEnd = originalTrimEnd ?? sourceDuration;
          const snappedTrimEnd = baseTrimEnd + snappedDelta;

          if (snappedTrimEnd <= sourceDuration) {
            newEndTime = snapResult.time;
            newTrimEnd = snappedTrimEnd;
            activeSnapTime.value = snapResult.time;
            activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
          } else {
            activeSnapTime.value = null;
            activeSnapTrackType.value = null;
          }
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        // Min duration check
        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          newTrimEnd = originalTrimStart + (newEndTime - newStartTime);
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        newTrimStart = originalTrimStart;
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
          activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newStartTime = newEndTime - minDuration;
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }
      } else {
        // Right handle - CapCut-style: NO upper bound constraint for overlays
        const originalEndPercent = effectiveTimeToVisualPercent(resizeInfo.value.originalEndTime);
        // Remove the Math.min(100, ...) constraint - allow extending beyond 100%
        const newEndPercent = originalEndPercent + deltaPercent;
        newEndTime = visualPercentToEffectiveTime(Math.max(0, newEndPercent));

        // Apply snapping to the right edge (no upper bound check)
        const snapResult = applySnapToTime(newEndTime, resizeInfo.value.id);
        if (snapResult.didSnap) {
          newEndTime = snapResult.time;
          activeSnapTime.value = snapResult.time;
          activeSnapTrackType.value = snapResult.snapTarget?.trackType || null;
        } else {
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }

        if (newEndTime - newStartTime < minDuration) {
          newEndTime = newStartTime + minDuration;
          activeSnapTime.value = null;
          activeSnapTrackType.value = null;
        }
        // Note: No upper bound constraint - overlays can extend beyond source duration
        // The totalDuration computed will automatically grow to accommodate
      }
    }

    // Update local preview state (no database call)
    dragPreview.value = {
      type: resizeInfo.value.type,
      id: resizeInfo.value.id,
      startTime: newStartTime,
      endTime: newEndTime,
      trimStart: newTrimStart,
      trimEnd: newTrimEnd,
    };

    // Update Ripple State
    if (isRippleTool.value) {
      let delta = 0;
      let originalEdgeTime = 0;

      if (resizeInfo.value.handle === 'left') {
        delta = newStartTime - resizeInfo.value.originalStartTime;
        originalEdgeTime = resizeInfo.value.originalStartTime;
      } else {
        delta = newEndTime - resizeInfo.value.originalEndTime;
        originalEdgeTime = resizeInfo.value.originalEndTime;
      }

      rippleState.value = {
        type: resizeInfo.value.type,
        id: resizeInfo.value.id,
        delta,
        originalEdgeTime,
      };
    }

    // Update Roll State
    if (isRollTool.value && resizeInfo.value.type === 'source' && props.videoSources) {
      // Identify neighbors if we haven't already (or update time)
      const handle = resizeInfo.value.handle;
      const itemId = resizeInfo.value.id;
      let leftId = '';
      let rightId = '';
      let originalRollTime = 0;
      let newRollTime = 0;

      if (handle === 'right') {
        // Dragging the boundary between Item (Left) and Neighbor (Right)
        leftId = itemId;
        originalRollTime = resizeInfo.value.originalEndTime;
        newRollTime = newEndTime;

        // Find right neighbor
        const neighbor = props.videoSources.find(
          (s) => Math.abs(s.start_time - originalRollTime) < 0.01 && s.id !== itemId
        );
        if (neighbor) rightId = neighbor.id;
      } else {
        // Dragging the boundary between Neighbor (Left) and Item (Right)
        rightId = itemId;
        originalRollTime = resizeInfo.value.originalStartTime;
        newRollTime = newStartTime;

        // Find left neighbor
        const neighbor = props.videoSources.find(
          (s) => Math.abs(s.end_time - originalRollTime) < 0.01 && s.id !== itemId
        );
        if (neighbor) leftId = neighbor.id;
      }

      if (leftId && rightId) {
        rollState.value = {
          type: 'source',
          leftItemId: leftId,
          rightItemId: rightId,
          originalRollTime,
          newRollTime,
          activeHandle: handle,
        };
      }
    }
  }

  function onResizeEnd() {
    // Commit the final position to database
    if (dragPreview.value) {
      if (isRippleTool.value && rippleState.value) {
        // Emit Ripple Edit event
        emit('rippleEdit', {
          type: dragPreview.value.type,
          id: dragPreview.value.id,
          newStartTime: dragPreview.value.startTime,
          newEndTime: dragPreview.value.endTime,
          delta: rippleState.value.delta,
        });
      } else if (isRollTool.value && rollState.value) {
        // Emit Roll Edit event
        emit('rollEdit', {
          type: rollState.value.type,
          leftItemId: rollState.value.leftItemId,
          rightItemId: rollState.value.rightItemId,
          newRollTime: rollState.value.newRollTime,
          originalRollTime: rollState.value.originalRollTime,
        });
      } else if (dragPreview.value.type === 'source') {
        // Source Resize with trims
        emit('updateSource', dragPreview.value.id, {
          start_time: dragPreview.value.startTime,
          end_time: dragPreview.value.endTime,
          trim_start: dragPreview.value.trimStart,
          trim_end: dragPreview.value.trimEnd,
        });
      } else {
        // Standard Resize
        emitUpdate(
          dragPreview.value.type,
          dragPreview.value.id,
          dragPreview.value.startTime,
          dragPreview.value.endTime
        );
      }
    }

    isResizing.value = false;
    resizeInfo.value = null;
    dragPreview.value = null;
    rippleState.value = null;
    rollState.value = null;
    activeSnapTime.value = null;
    activeSnapTrackType.value = null;

    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);

    // Trigger final waveform render after resize completes
    nextTick(() => {
      debouncedRenderAllWaveforms();
    });
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

  // Waveform rendering - uses new waveformService for on-demand peak calculation
  function renderWaveformForSegment(segmentId: string, segment: TrimSegment) {
    const canvas = waveformCanvasRefs.value.get(segmentId);
    if (!canvas || !props.videoSrc) return;

    // Check if waveform data is loaded
    if (!waveformService.isLoaded(props.videoSrc)) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Segment times are relative to the clip (0 to duration)
      // Convert to absolute source video times for waveform extraction
      const absoluteStartTime = props.clipStart + segment.startTime;
      const absoluteEndTime = props.clipStart + segment.endTime;
      const segmentDuration = segment.endTime - segment.startTime;

      // Calculate playhead position within segment
      const isWithinSegment = props.currentTime >= segment.startTime && props.currentTime <= segment.endTime;
      const playheadRatio = isWithinSegment
        ? (props.currentTime - segment.startTime) / segmentDuration
        : props.currentTime < segment.startTime
          ? 0
          : 1;

      // Get peaks on-demand from waveform service (1 peak per pixel for maximum accuracy)
      const gainMultiplier = dbToLinear(props.audioGainDb ?? 0);
      const peaks = waveformService.getPeaksForRange(props.videoSrc, {
        startTime: absoluteStartTime,
        endTime: absoluteEndTime,
        pixelWidth: Math.floor(rect.width),
        gainMultiplier,
      });

      if (peaks.length === 0) return;

      // Normalize peaks for display (makes quiet audio visible)
      const normalizedPeaks = normalizePeaks(peaks);

      // Use the unified renderer
      renderWaveform(canvas, {
        width: rect.width,
        height: rect.height,
        peaks: normalizedPeaks,
        playheadRatio,
        style: 'bars',
        useGradientColors: true,
      });
    } catch (error) {
      console.error('[ClipEditorTimeline] Error rendering waveform:', error);
    }
  }

  function renderAllWaveforms() {
    if (!props.videoSrc || !waveformService.isLoaded(props.videoSrc)) return;

    sortedTrimSegments.value.forEach((segment) => {
      renderWaveformForSegment(segment.id, segment);
    });
  }

  // Video source waveform functions (editor mode) - uses new waveformService

  async function loadSourceWaveform(sourceId: string, sourcePath: string): Promise<void> {
    // Skip if already loaded or currently loading
    if (waveformService.isLoaded(sourcePath) || sourceWaveformLoading.value.has(sourceId)) {
      // If already loaded, just render
      if (waveformService.isLoaded(sourcePath)) {
        nextTick(() => renderSourceWaveform(sourceId));
      }
      return;
    }

    sourceWaveformLoading.value.add(sourceId);

    try {
      console.log('[ClipEditorTimeline] Loading waveform for source:', sourceId);
      await waveformService.loadAudio(sourcePath);

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
    const source = props.videoSources.find((s) => s.id === sourceId);

    if (!canvas || !source || !source.source_path) return;
    if (!waveformService.isLoaded(source.source_path)) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Get the trim range for this source
      const trimStart = source.trim_start ?? 0;
      const segmentDuration = source.end_time - source.start_time;
      const trimEnd = source.trim_end ?? trimStart + segmentDuration;

      // Get peaks on-demand from waveform service (1 peak per pixel for maximum accuracy)
      const gainMultiplier = dbToLinear(props.audioGainDb ?? 0);
      const peaks = waveformService.getPeaksForRange(source.source_path, {
        startTime: trimStart,
        endTime: trimEnd,
        pixelWidth: Math.floor(rect.width),
        gainMultiplier,
      });

      if (peaks.length === 0) return;

      // Normalize peaks for display (makes quiet audio visible)
      const normalizedPeaks = normalizePeaks(peaks);

      // Use the unified renderer
      renderAudioTrackWaveform(canvas, normalizedPeaks, rect.width, rect.height, {
        style: 'bars',
        useGradientColors: true,
      });
    } catch (err) {
      console.error('[ClipEditorTimeline] Error rendering source waveform:', sourceId, err);
    }
  }

  function renderAllSourceWaveforms(): void {
    if (!props.editorMode) return;

    props.videoSources.forEach((source) => {
      if (source.source_path && waveformService.isLoaded(source.source_path)) {
        renderSourceWaveform(source.id);
      }
    });
  }

  // Audio track waveform functions - uses new waveformService
  async function loadAudioWaveform(trackId: string, audioSrc: string): Promise<void> {
    // Skip if already loaded or currently loading
    if (waveformService.isLoaded(audioSrc) || audioWaveformLoading.value.has(trackId)) {
      // If already loaded, just render
      if (waveformService.isLoaded(audioSrc)) {
        nextTick(() => renderAudioWaveform(trackId));
      }
      return;
    }

    // For blob URLs (legacy/invalid), skip - can't load
    if (audioSrc.startsWith('blob:')) {
      console.warn('[loadAudioWaveform] Blob URLs not supported:', trackId);
      return;
    }

    audioWaveformLoading.value.add(trackId);

    try {
      console.log('[loadAudioWaveform] Loading audio for track:', trackId);
      await waveformService.loadAudio(audioSrc);

      // Render the waveform
      nextTick(() => renderAudioWaveform(trackId));
    } catch (err) {
      console.error('[loadAudioWaveform] Failed to load audio waveform:', trackId, err);
    } finally {
      audioWaveformLoading.value.delete(trackId);
    }
  }

  function renderAudioWaveform(trackId: string): void {
    const track = props.audioTracks.find((t) => t.id === trackId);
    if (!track || !track.filePath) return;
    if (!waveformService.isLoaded(track.filePath)) return;

    // Get visual segments for this track
    const visualSegments = getAudioVisualSegments(track);

    // Render each visual segment
    visualSegments.forEach((visualSeg, segIdx) => {
      renderAudioVisualSegmentWaveform(trackId, segIdx, visualSeg, track);
    });
  }

  function renderAudioVisualSegmentWaveform(
    trackId: string,
    segIdx: number,
    visualSeg: AudioVisualSegment,
    track: AudioTrack
  ): void {
    const canvas = audioSegmentCanvasRefs.value.get(`${trackId}-${segIdx}`);
    if (!canvas || !track.filePath) return;
    if (!waveformService.isLoaded(track.filePath)) return;

    try {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;

      // Apply per-track volume and dB gain (matching audio playback behavior)
      const trackDbGain = props.trackDbValues?.[trackId] ?? 0;
      const dbGainMultiplier = dbToLinear(trackDbGain);
      const gainMultiplier = track.volume * dbGainMultiplier;

      // Get peaks on-demand from waveform service (1 peak per pixel for maximum accuracy)
      const peaks = waveformService.getPeaksForRange(track.filePath, {
        startTime: visualSeg.audioStartTime,
        endTime: visualSeg.audioEndTime,
        pixelWidth: Math.floor(rect.width),
        gainMultiplier,
      });

      if (peaks.length === 0) return;

      // Normalize peaks for display (makes quiet audio visible)
      const normalizedPeaks = normalizePeaks(peaks);

      // Use the unified renderer
      renderAudioTrackWaveform(canvas, normalizedPeaks, rect.width, rect.height, {
        style: 'bars',
        useGradientColors: true,
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
        console.log('[ClipEditorTimeline] Loading waveform for video:', newVideoSrc);
        // Load waveform using the new waveformService
        await loadWaveformFromVideo(newVideoSrc);
      }
    },
    { immediate: true }
  );

  // Watch for waveform and segment changes
  // Uses debounced rendering and skips during active interactions
  watch(
    [waveformData, isWaveformLoaded, () => props.currentTime, zoomLevel, sortedTrimSegments],
    () => {
      if (isWaveformLoaded.value && waveformData.value) {
        // Skip render during active interactions - will render when interaction ends
        if (isZooming.value || isDragging.value || isResizing.value) return;
        nextTick(() => {
          debouncedRenderAllWaveforms();
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
        // Skip during interactions - render when idle
        if (isZooming.value || isDragging.value || isResizing.value) return;
        nextTick(() => {
          debouncedRenderAllWaveforms();
        });
      }
    }
  );

  // Watch for per-track dB value changes to re-render audio track waveforms
  watch(
    () => props.trackDbValues,
    () => {
      // Skip during interactions
      if (isZooming.value || isDragging.value || isResizing.value) return;
      nextTick(() => {
        debouncedRenderWaveforms();
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
        if (track.filePath && !waveformService.isLoaded(track.filePath)) {
          await loadAudioWaveform(track.id, track.filePath);
        }
      }

      // Clean up canvas refs for removed tracks
      const trackIds = new Set(newTracks.map((t) => t.id));
      audioWaveformCanvasRefs.value.forEach((_, id) => {
        if (!trackIds.has(id)) {
          audioWaveformCanvasRefs.value.delete(id);
        }
      });

      // Re-render all audio waveforms to reflect any property changes (volume, etc.)
      // Skip during active interactions
      if (isZooming.value || isDragging.value || isResizing.value) return;
      nextTick(() => {
        debouncedRenderWaveforms();
      });
    },
    { deep: true, immediate: true }
  );

  // Watch for current time and zoom level changes to update audio waveforms
  // This is a high-frequency watcher - use debouncing and skip during interactions
  watch([() => props.currentTime, zoomLevel], () => {
    // Skip render during active zoom/drag - will render when interaction ends
    if (isZooming.value || isDragging.value || isResizing.value) return;
    nextTick(() => {
      debouncedRenderWaveforms();
    });
  });

  // Watch for drag preview changes to re-render audio waveforms when segments split/merge
  // Only render when drag ends (dragPreview becomes null) or for structural changes
  watch(
    dragPreview,
    (newVal, oldVal) => {
      // Skip during active drag - the segment visuals update via dragPreview styles
      // Only render when drag ends (newVal is null) to show final state
      if (newVal !== null) return;

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
        if (source.source_path && !waveformService.isLoaded(source.source_path)) {
          await loadSourceWaveform(source.id, source.source_path);
        }
      }

      // Clean up canvas refs for removed sources
      const sourceIds = new Set(newSources.map((s) => s.id));
      sourceWaveformCanvasRefs.value.forEach((_, id) => {
        if (!sourceIds.has(id)) {
          sourceWaveformCanvasRefs.value.delete(id);
        }
      });

      // Re-render all source waveforms after DOM updates
      // Skip during active interactions
      if (isZooming.value || isDragging.value || isResizing.value) return;
      nextTick(() => {
        debouncedRenderWaveforms();
      });
    },
    { deep: true, immediate: true }
  );

  // Watch for current time and zoom changes to update source waveforms (for playhead position)
  // This is a high-frequency watcher - skip during interactions
  watch([() => props.currentTime, zoomLevel], () => {
    if (props.editorMode) {
      // Skip during active interactions - will render when interaction ends
      if (isZooming.value || isDragging.value || isResizing.value) return;
      nextTick(() => {
        debouncedRenderWaveforms();
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
    // This matches the CSS: left: calc(120px + (100% - 120px) * position)
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
    // During dragging, use optimistic position to avoid round-trip lag
    // This shows the playhead exactly where the user is dragging, not where
    // the video has caught up to (which can lag behind during fast dragging)
    if (isDraggingPlayhead.value && optimisticDragTime.value !== null) {
      const duration = props.editorMode ? props.duration : totalDuration.value;
      if (duration > 0) {
        return Math.min(1, Math.max(0, optimisticDragTime.value / duration));
      }
    }
    // During playback, use smooth animated position
    if (props.isPlaying) {
      return smoothPlayheadPosition.value;
    }
    // When paused, use exact computed position
    return playheadPosition.value;
  });

  // Computed position for snap indicator line (0-1 range like playhead)
  // Must use totalDuration.value to match segment positioning via effectiveTimeToVisualPercent
  const snapIndicatorPosition = computed(() => {
    if (activeSnapTime.value === null) return null;
    const duration = totalDuration.value;
    if (duration <= 0) return null;
    return activeSnapTime.value / duration;
  });

  // Computed color class for snap indicator based on track type (cross-track snapping visual feedback)
  const snapIndicatorColorClass = computed(() => {
    const trackType = activeSnapTrackType.value;
    switch (trackType) {
      case 'video':
        return 'bg-blue-400 shadow-blue-400/50';
      case 'audio':
        return 'bg-green-400 shadow-green-400/50';
      case 'text':
        return 'bg-purple-400 shadow-purple-400/50';
      case 'sticker':
        return 'bg-pink-400 shadow-pink-400/50';
      case 'watermark':
        return 'bg-cyan-400 shadow-cyan-400/50';
      case 'effect':
        return 'bg-orange-400 shadow-orange-400/50';
      case 'filter':
        return 'bg-yellow-400 shadow-yellow-400/50';
      case 'system':
        return 'bg-amber-400 shadow-amber-400/50'; // Playhead, markers, boundaries
      default:
        return 'bg-blue-400 shadow-blue-400/50';
    }
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

    // Copy/Paste/Duplicate/Group shortcuts (Ctrl/Cmd + C/V/D/G)
    if (event.ctrlKey || event.metaKey) {
      switch (event.key.toLowerCase()) {
        case 'c':
          // Copy selected items
          if (!event.shiftKey) {
            event.preventDefault();
            copySelectedItems();
            return;
          }
          break;
        case 'v':
          // Paste at playhead or in place
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+V = Paste in place (original position)
            pasteItemsInPlace();
          } else {
            // Ctrl+V = Paste at playhead
            pasteItems();
          }
          return;
        case 'd':
          // Duplicate selected items
          event.preventDefault();
          duplicateSelectedItems();
          return;
        case 'g':
          // Group/Ungroup selected items
          event.preventDefault();
          if (event.shiftKey) {
            // Ctrl+Shift+G = Ungroup
            ungroupSelectedItems();
          } else {
            // Ctrl+G = Group
            groupSelectedItems();
          }
          return;
      }
    }

    // Perform cut at playhead with X key or Ctrl+K
    if (
      event.key === 'x' ||
      event.key === 'X' ||
      ((event.ctrlKey || event.metaKey) && (event.key === 'k' || event.key === 'K'))
    ) {
      event.preventDefault();
      performCutAtPlayhead();
    }

    // Tool Shortcuts and J-K-L Playback Control
    if (!event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey) {
      switch (event.key.toLowerCase()) {
        case 'v':
          setTool('move');
          break;
        case 'c':
          setTool('razor');
          // Also toggle the internal legacy state if needed, or rely on watchers
          isCutToolActive.value = true;
          break;
        case 'b':
          setTool('ripple');
          break;
        case 'n':
          setTool('roll');
          break;
        case 'y':
          setTool('slip');
          break;
        case 'u':
          setTool('slide');
          break;
        // J-K-L Playback Control (industry standard)
        case 'j':
          // J = Play backward / decrease speed
          event.preventDefault();
          if (jklPlaybackSpeed.value > 0) {
            // If playing forward, stop first
            jklPlaybackSpeed.value = -1;
          } else if (jklPlaybackSpeed.value === 0) {
            // If stopped, start reverse at 1x
            jklPlaybackSpeed.value = -1;
          } else {
            // Already playing backward, increase reverse speed
            jklPlaybackSpeed.value = Math.max(-4, jklPlaybackSpeed.value - 1);
          }
          emit('setPlaybackSpeed', jklPlaybackSpeed.value);
          break;
        case 'k':
          // K = Stop/Pause
          event.preventDefault();
          jklPlaybackSpeed.value = 0;
          emit('togglePlayback');
          break;
        case 'l':
          // L = Play forward / increase speed
          event.preventDefault();
          if (jklPlaybackSpeed.value < 0) {
            // If playing backward, stop first
            jklPlaybackSpeed.value = 1;
          } else if (jklPlaybackSpeed.value === 0) {
            // If stopped, start forward at 1x
            jklPlaybackSpeed.value = 1;
          } else {
            // Already playing forward, increase speed
            jklPlaybackSpeed.value = Math.min(4, jklPlaybackSpeed.value + 1);
          }
          emit('setPlaybackSpeed', jklPlaybackSpeed.value);
          break;
        // Space bar for play/pause toggle
        case ' ':
          event.preventDefault();
          emit('togglePlayback');
          break;
        // M key to add marker at current playhead position
        case 'm':
          event.preventDefault();
          addMarkerAtPlayhead();
          break;
        // Zoom shortcuts (without modifiers)
        case '=':
        case '+':
          event.preventDefault();
          zoomIn();
          break;
        case '-':
          event.preventDefault();
          zoomOut();
          break;
        // Z key for zoom to fit (Shift+Z for zoom to selection)
        case 'z':
          event.preventDefault();
          zoomToFit();
          break;
        // I key for set in point
        case 'i':
          event.preventDefault();
          emit('setInPoint', props.currentTime);
          break;
        // O key for set out point
        case 'o':
          event.preventDefault();
          emit('setOutPoint', props.currentTime);
          break;
      }
    }

    // Shift+Z for zoom to selection
    if (event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      if (event.key.toLowerCase() === 'z') {
        event.preventDefault();
        zoomToSelection();
        return;
      }
    }

    // Deactivate cut tool with Escape key
    if (event.key === 'Escape') {
      if (isCutToolActive.value || activeTool.value !== 'move') {
        event.preventDefault();
        isCutToolActive.value = false;
        setTool('move');
        cutHoverInfo.value = null;
      }
    }

    // Handle arrow keys for frame-by-frame seeking (precise millisecond navigation)
    // In editor mode, use props.duration (editor timeline duration)
    // In clip mode, use the clip duration from clipEnd - clipStart
    const maxDuration = props.editorMode
      ? props.duration || totalDuration.value
      : props.clipEnd && props.clipStart !== undefined
        ? props.clipEnd - props.clipStart
        : totalDuration.value;
    const frameTime = 1 / 30; // Assume 30fps for frame-accurate stepping

    if (!isCutToolActive.value && maxDuration > 0) {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (event.shiftKey) {
          // Shift+ArrowLeft = 10 frames back (for faster navigation)
          emit('seek', Math.max(0, props.currentTime - frameTime * 10));
        } else if (event.altKey) {
          // Alt+ArrowLeft = 1 second back
          emit('seek', Math.max(0, props.currentTime - 1));
        } else {
          // ArrowLeft = 1 frame back (precise frame-by-frame)
          emit('seek', Math.max(0, props.currentTime - frameTime));
        }
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (event.shiftKey) {
          // Shift+ArrowRight = 10 frames forward (for faster navigation)
          emit('seek', Math.min(maxDuration, props.currentTime + frameTime * 10));
        } else if (event.altKey) {
          // Alt+ArrowRight = 1 second forward
          emit('seek', Math.min(maxDuration, props.currentTime + 1));
        } else {
          // ArrowRight = 1 frame forward (precise frame-by-frame)
          emit('seek', Math.min(maxDuration, props.currentTime + frameTime));
        }
      }
    }

    // Numpad navigation for frame-by-frame control
    // Numpad 4/6 = frame back/forward, Numpad 1/3 = 10 frames, Numpad 7/9 = 1 second
    if (!event.ctrlKey && !event.metaKey) {
      switch (event.code) {
        case 'Numpad4':
          // Numpad 4 = 1 frame back
          event.preventDefault();
          emit('seek', Math.max(0, props.currentTime - frameTime));
          break;
        case 'Numpad6':
          // Numpad 6 = 1 frame forward
          event.preventDefault();
          emit('seek', Math.min(maxDuration, props.currentTime + frameTime));
          break;
        case 'Numpad1':
          // Numpad 1 = 10 frames back
          event.preventDefault();
          emit('seek', Math.max(0, props.currentTime - frameTime * 10));
          break;
        case 'Numpad3':
          // Numpad 3 = 10 frames forward
          event.preventDefault();
          emit('seek', Math.min(maxDuration, props.currentTime + frameTime * 10));
          break;
        case 'Numpad7':
          // Numpad 7 = 1 second back
          event.preventDefault();
          emit('seek', Math.max(0, props.currentTime - 1));
          break;
        case 'Numpad9':
          // Numpad 9 = 1 second forward
          event.preventDefault();
          emit('seek', Math.min(maxDuration, props.currentTime + 1));
          break;
        case 'Numpad5':
          // Numpad 5 = Go to start
          event.preventDefault();
          emit('seek', 0);
          break;
        case 'Numpad0':
          // Numpad 0 = Go to end
          event.preventDefault();
          emit('seek', maxDuration);
          break;
        case 'Numpad2':
          // Numpad 2 = Go to in point
          event.preventDefault();
          emit('goToInPoint');
          break;
        case 'Numpad8':
          // Numpad 8 = Go to out point
          event.preventDefault();
          emit('goToOutPoint');
          break;
      }
    }
  }

  // Handle keyboard key up events
  function handleKeyUp(event: KeyboardEvent) {
    // Don't handle keyboard events if user is typing in input fields
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
      return;
    }

    // Arrow keys now use single-frame stepping, no continuous seeking to stop
    // Keep this handler for potential future use with other keys
  }

  // Lifecycle
  onMounted(() => {
    nextTick(async () => {
      setupResizeObserver();
      // Initialize zoom to fit-to-width
      initializeZoom();
      // Initialize visible time range for virtualized rendering
      updateVisibleTimeRange();
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
    // Clean up audio scrubbing
    cleanupAudioScrubbing();
    // Clean up zoom-related RAF and timeouts
    if (zoomRAFId) {
      cancelAnimationFrame(zoomRAFId);
      zoomRAFId = null;
    }
    if (zoomEndTimeout) {
      clearTimeout(zoomEndTimeout);
      zoomEndTimeout = null;
    }
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
    /* Performance: contain layout to prevent reflows from affecting parent */
    contain: layout style;
  }

  /* Sticky track labels - prevent sub-pixel jitter during scroll */
  :deep(.sticky) {
    transform: translateZ(0);
    backface-visibility: hidden;
    -webkit-backface-visibility: hidden;
  }

  /* Timeline content wrapper - optimize for zoom transforms */
  .timeline-content-wrapper {
    /* Promote to compositor layer for smoother width changes during zoom */
    will-change: width;
    transform: translateZ(0);
    /* CSS containment for performance - prevents layout thrashing */
    contain: layout style;
  }

  .timeline-tick {
    /* Remove transition during rapid updates for performance */
    transition: none;
    /* Each tick is independent - prevent layout recalculation cascade */
    contain: layout style;
  }

  /* Track content areas - contain layout to prevent reflows */
  .track-label {
    contain: layout style;
  }

  /* Clip segment animations */
  .clip-segment {
    transition:
      transform 0.2s ease-out,
      box-shadow 0.2s ease-out,
      border-color 0.15s ease;
    will-change: transform, box-shadow;
    /* CSS containment - each segment is visually independent */
    contain: layout style;
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
  /* Label width is w-[120px] = 120px, track content is the remaining width */
  .playhead-line {
    --playhead-position: 0;
    left: calc(120px + (100% - 120px) * var(--playhead-position));
    will-change: left;
    /* No transition for immediate positioning */
    transition: none;
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
    left: calc(120px + (100% - 120px) * var(--snap-position));
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

  /* Track label text scrolling marquee for long names */
  .track-label-text-container {
    position: relative;
    max-width: 60px;
  }

  .track-label-text {
    display: inline-flex;
    gap: 24px; /* Gap between original and duplicate text */
  }

  /* Hide duplicate by default */
  .track-label-text-duplicate {
    display: none;
  }

  /* On hover, show duplicate and animate */
  .track-label-text-container:hover .track-label-text-duplicate {
    display: inline;
  }

  .track-label-text-container:hover .track-label-text {
    animation: marquee-scroll 3s linear infinite;
  }

  @keyframes marquee-scroll {
    0% {
      transform: translateX(0);
    }
    100% {
      transform: translateX(calc(-50% - 12px)); /* Account for half the gap */
    }
  }

  /* Mask to fade edges for smooth scroll appearance */
  .track-label-text-container::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 10px;
    background: linear-gradient(to right, transparent, #0e0e10);
    pointer-events: none;
  }
</style>
