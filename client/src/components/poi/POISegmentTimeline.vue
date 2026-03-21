<template>
  <div class="poi-segment-timeline border-t border-zinc-800 bg-zinc-900/70">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <div class="flex flex-col gap-0.5">
        <div class="flex items-center gap-2">
          <div class="text-sm font-semibold text-zinc-200">Time-Based Regions</div>
          <span class="text-xs text-zinc-500">{{ segments.length }} segment{{ segments.length !== 1 ? 's' : '' }}</span>
        </div>
        <div class="text-xs text-zinc-400">Set different regions for specific time periods</div>
      </div>
      <button
        @click="addSegment"
        class="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-blue-400 hover:text-blue-300 bg-blue-500/10 hover:bg-blue-500/20 rounded transition-colors"
        :disabled="!canAddSegment"
        :class="{ 'opacity-50 cursor-not-allowed': !canAddSegment }"
      >
        <PlusIcon class="w-3 h-3" />
        Add Segment
      </button>
    </div>

    <!-- Timeline -->
    <div class="px-4 py-3">
      <!-- Time markers -->
      <div class="flex items-center justify-between mb-2 px-1">
        <span class="text-[10px] text-zinc-500 font-mono">0:00</span>
        <span class="text-[10px] text-zinc-500 font-mono">{{ formatTime(duration) }}</span>
      </div>

      <!-- Timeline track -->
      <div 
        ref="timelineRef"
        class="relative h-12 bg-zinc-900/50 rounded-lg border border-zinc-800/50 overflow-hidden"
        @click="onTimelineClick"
      >
        <!-- Filmstrip background -->
        <div class="absolute inset-0 bg-black/20">
          <canvas
            v-if="videoUrl"
            ref="filmstripCanvasRef"
            class="absolute inset-0 w-full h-full opacity-60 blur-[0.5px]"
          />
          <img
            v-else-if="thumbnailUrl"
            :src="thumbnailUrl"
            class="absolute inset-0 w-full h-full object-cover opacity-60 blur-[0.5px]"
            alt="Timeline preview"
          />
        </div>
        
        <!-- Hidden video for frame extraction -->
        <video
          v-if="videoUrl"
          ref="filmstripVideoRef"
          :src="videoUrl"
          class="hidden"
          preload="metadata"
          muted
          playsinline
          @loadedmetadata="generateFilmstrip"
        />
        
        <!-- Dark overlay for better contrast -->
        <div class="absolute inset-0 bg-gradient-to-b from-zinc-900/40 via-zinc-900/20 to-zinc-900/40" />
        <!-- Segments -->
        <div
          v-for="(segment, index) in segments"
          :key="segment.segmentId"
          class="absolute top-0 bottom-0 group transition-all duration-150"
          :style="getSegmentStyle(segment)"
          @click.stop="selectSegment(segment.segmentId)"
        >
          <!-- Segment bar -->
          <div 
            class="absolute inset-0 rounded-md transition-all cursor-move"
            :class="{
              'bg-gradient-to-r from-blue-500/40 to-blue-600/40 border-2 border-blue-400 shadow-lg shadow-blue-500/20': activeSegmentId === segment.segmentId,
              'bg-gradient-to-r from-zinc-700/60 to-zinc-600/60 border border-zinc-600/80 hover:border-zinc-500': activeSegmentId !== segment.segmentId,
            }"
            @mousedown.stop="(e) => startDragSegment(e, segment.segmentId)"
          >
            <!-- Segment label -->
            <div class="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <span 
                class="text-[10px] font-semibold tracking-wide"
                :class="activeSegmentId === segment.segmentId ? 'text-blue-200' : 'text-zinc-300'"
              >
                Segment {{ index + 1 }}
              </span>
              <span 
                class="text-[9px] font-mono mt-0.5"
                :class="activeSegmentId === segment.segmentId ? 'text-blue-300/80' : 'text-zinc-400'"
              >
                {{ formatTime(segment.startTime) }} - {{ formatTime(segment.endTime) }}
              </span>
            </div>
          </div>

          <!-- Left resize handle -->
          <div
            class="absolute left-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 transition-all"
            :class="{
              'bg-blue-400 hover:bg-blue-300 hover:w-1.5': activeSegmentId === segment.segmentId,
              'bg-zinc-600/50 hover:bg-zinc-500 hover:w-1.5': activeSegmentId !== segment.segmentId,
            }"
            @mousedown.stop="(e) => startResize(e, segment.segmentId, 'start')"
            title="Drag to adjust start time"
          />

          <!-- Right resize handle -->
          <div
            class="absolute right-0 top-0 bottom-0 w-1 cursor-ew-resize z-10 transition-all"
            :class="{
              'bg-blue-400 hover:bg-blue-300 hover:w-1.5': activeSegmentId === segment.segmentId,
              'bg-zinc-600/50 hover:bg-zinc-500 hover:w-1.5': activeSegmentId !== segment.segmentId,
            }"
            @mousedown.stop="(e) => startResize(e, segment.segmentId, 'end')"
            title="Drag to adjust end time"
          />

          <!-- Delete button -->
          <button
            @click.stop="deleteSegment(segment.segmentId)"
            class="absolute -top-7 left-1/2 -translate-x-1/2 w-5 h-5 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110 z-30"
            title="Delete segment"
          >
            <XIcon class="w-3 h-3" />
          </button>
        </div>

        <!-- Playhead indicator -->
        <div
          v-if="currentTime !== null"
          class="absolute top-0 bottom-0 w-0.5 bg-white/90 z-20 shadow-lg cursor-ew-resize"
          :style="{ left: `${(currentTime / duration) * 100}%` }"
          @mousedown.stop="startDragPlayhead"
        >
          <div 
            class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-zinc-900 cursor-ew-resize hover:scale-125 transition-transform"
            @mousedown.stop="startDragPlayhead"
          />
        </div>
      </div>
    </div>

    <!-- Active segment info -->
    <div v-if="activeSegment" class="px-3 pb-2">
      <div class="flex items-center gap-2 text-[10px] text-zinc-400">
        <span class="font-medium text-blue-400">Active:</span>
        <span>Segment {{ getSegmentIndex(activeSegment.segmentId) + 1 }}</span>
        <span>•</span>
        <span>{{ activeSegment.regions.length }} region{{ activeSegment.regions.length !== 1 ? 's' : '' }}</span>
        <span>•</span>
        <span>{{ formatTime(activeSegment.startTime) }} - {{ formatTime(activeSegment.endTime) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { computed, ref } from 'vue';
  import { PlusIcon, XIcon } from 'lucide-vue-next';
  import type { SegmentRegionConfig, ManualRegion } from '@/types';

  interface Props {
    segments: SegmentRegionConfig[];
    activeSegmentId: string | null;
    duration: number;
    currentTime: number | null;
    videoUrl?: string | null;
    thumbnailUrl?: string | null;
    clipStartTime?: number;
    clipEndTime?: number;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    addSegment: [];
    deleteSegment: [segmentId: string];
    selectSegment: [segmentId: string];
    updateSegment: [segmentId: string, updates: { startTime?: number; endTime?: number }];
    seekTime: [time: number];
  }>();

  const timelineRef = ref<HTMLElement | null>(null);
  const filmstripVideoRef = ref<HTMLVideoElement | null>(null);
  const filmstripCanvasRef = ref<HTMLCanvasElement | null>(null);
  const isResizing = ref(false);
  const resizingSegmentId = ref<string | null>(null);
  const resizingEdge = ref<'start' | 'end' | null>(null);
  
  const isDragging = ref(false);
  const draggingSegmentId = ref<string | null>(null);
  const dragStartX = ref(0);
  const dragStartTime = ref(0);

  const isDraggingPlayhead = ref(false);

  // Generate filmstrip with multiple frames across timeline
  async function generateFilmstrip() {
    if (!filmstripVideoRef.value || !filmstripCanvasRef.value || !timelineRef.value) return;
    
    const video = filmstripVideoRef.value;
    const canvas = filmstripCanvasRef.value;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size to match timeline
    const rect = timelineRef.value.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    // Use clip start/end times if provided, otherwise use full video duration
    const clipStart = props.clipStartTime || 0;
    const clipEnd = props.clipEndTime || video.duration;
    const clipDuration = clipEnd - clipStart;

    const frameCount = Math.min(40, Math.floor(rect.width / 30)); // One frame every ~30px, max 40 frames
    const frameWidth = rect.width / frameCount;

    // Draw frames across the timeline (only from clip portion)
    for (let i = 0; i < frameCount; i++) {
      // Calculate time within the clip range
      const clipProgress = i / frameCount;
      const absoluteTime = clipStart + (clipProgress * clipDuration);
      video.currentTime = absoluteTime;
      
      // Wait for seek to complete
      await new Promise<void>((resolve) => {
        const onSeeked = () => {
          video.removeEventListener('seeked', onSeeked);
          resolve();
        };
        video.addEventListener('seeked', onSeeked);
      });

      // Calculate aspect-ratio-preserving dimensions
      const videoAspect = video.videoWidth / video.videoHeight;
      const frameHeight = rect.height;
      const scaledWidth = frameHeight * videoAspect;
      
      // Draw this frame
      const x = i * frameWidth;
      ctx.drawImage(video, x, 0, scaledWidth, frameHeight);
    }
  }

  // Get active segment
  const activeSegment = computed(() => {
    return props.segments.find(s => s.segmentId === props.activeSegmentId) || null;
  });

  // Start dragging playhead
  function startDragPlayhead(e: MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    isDraggingPlayhead.value = true;
    
    document.addEventListener('mousemove', onDragPlayhead);
    document.addEventListener('mouseup', stopDragPlayhead);
  }

  // Handle playhead drag
  function onDragPlayhead(e: MouseEvent) {
    if (!isDraggingPlayhead.value || !timelineRef.value) return;
    
    const rect = timelineRef.value.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, x / rect.width));
    
    if (e.shiftKey) {
      // Precision mode: quantize to 0.01 second increments (10ms steps)
      const rawTime = percent * props.duration;
      const quantized = Math.round(rawTime / 0.01) * 0.01;
      emit('seekTime', Math.max(0, Math.min(props.duration, quantized)));
    } else {
      // Normal mode: direct position mapping
      const newTime = percent * props.duration;
      emit('seekTime', newTime);
    }
  }

  // Stop dragging playhead
  function stopDragPlayhead() {
    isDraggingPlayhead.value = false;
    document.removeEventListener('mousemove', onDragPlayhead);
    document.removeEventListener('mouseup', stopDragPlayhead);
  }

  // Check if can add more segments
  const canAddSegment = computed(() => {
    return props.duration > 0 && props.segments.length < 10;
  });

  // Get segment style for positioning
  function getSegmentStyle(segment: SegmentRegionConfig) {
    const startPercent = (segment.startTime / props.duration) * 100;
    const endPercent = (segment.endTime / props.duration) * 100;
    return {
      left: `${startPercent}%`,
      width: `${endPercent - startPercent}%`,
    };
  }

  // Get segment index
  function getSegmentIndex(segmentId: string): number {
    return props.segments.findIndex(s => s.segmentId === segmentId);
  }

  // Format time as MM:SS
  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  // Add segment
  function addSegment() {
    emit('addSegment');
  }

  // Delete segment
  function deleteSegment(segmentId: string) {
    emit('deleteSegment', segmentId);
  }

  // Select segment
  function selectSegment(segmentId: string) {
    emit('selectSegment', segmentId);
  }

  // Handle timeline click
  function onTimelineClick(e: MouseEvent) {
    if (!timelineRef.value) return;
    
    const rect = timelineRef.value.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const clickPercent = clickX / rect.width;
    const clickTime = clickPercent * props.duration;
    
    // Find if we clicked on an existing segment
    const clickedSegment = props.segments.find(s => 
      clickTime >= s.startTime && clickTime <= s.endTime
    );
    
    if (clickedSegment) {
      selectSegment(clickedSegment.segmentId);
    } else {
      // Seek to clicked position (don't auto-create segment)
      emit('seekTime', clickTime);
    }
  }

  // Start resizing a segment edge
  function startResize(e: MouseEvent, segmentId: string, edge: 'start' | 'end') {
    e.preventDefault();
    e.stopPropagation();
    
    isResizing.value = true;
    resizingSegmentId.value = segmentId;
    resizingEdge.value = edge;
    
    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', stopResize);
  }

  // Handle resize drag
  function onResizeMove(e: MouseEvent) {
    if (!isResizing.value || !timelineRef.value || !resizingSegmentId.value || !resizingEdge.value) return;
    
    const rect = timelineRef.value.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mousePercent = Math.max(0, Math.min(1, mouseX / rect.width));
    let newTime = mousePercent * props.duration;
    
    // Snap to playhead if within threshold (0.5 seconds)
    const snapThreshold = 0.5;
    if (props.currentTime !== null && Math.abs(newTime - props.currentTime) < snapThreshold) {
      newTime = props.currentTime;
    }
    
    const segment = props.segments.find(s => s.segmentId === resizingSegmentId.value);
    if (!segment) return;
    
    if (resizingEdge.value === 'start') {
      // Don't allow start to go past end
      const maxStart = segment.endTime - 0.5; // Min 0.5s segment
      const clampedStart = Math.max(0, Math.min(newTime, maxStart));
      emit('updateSegment', resizingSegmentId.value, { startTime: clampedStart });
    } else {
      // Don't allow end to go before start
      const minEnd = segment.startTime + 0.5; // Min 0.5s segment
      const clampedEnd = Math.min(props.duration, Math.max(newTime, minEnd));
      emit('updateSegment', resizingSegmentId.value, { endTime: clampedEnd });
    }
  }

  // Stop resizing
  function stopResize() {
    isResizing.value = false;
    resizingSegmentId.value = null;
    resizingEdge.value = null;
    
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', stopResize);
  }

  // Start dragging segment body (move entire segment)
  function startDragSegment(e: MouseEvent, segmentId: string) {
    e.preventDefault();
    e.stopPropagation();
    
    const segment = props.segments.find(s => s.segmentId === segmentId);
    if (!segment) return;
    
    isDragging.value = true;
    draggingSegmentId.value = segmentId;
    dragStartX.value = e.clientX;
    dragStartTime.value = segment.startTime;
    
    selectSegment(segmentId);
    
    document.addEventListener('mousemove', onDragMove);
    document.addEventListener('mouseup', stopDrag);
  }

  // Handle segment drag
  function onDragMove(e: MouseEvent) {
    if (!isDragging.value || !timelineRef.value || !draggingSegmentId.value) return;
    
    const segment = props.segments.find(s => s.segmentId === draggingSegmentId.value);
    if (!segment) return;
    
    const rect = timelineRef.value.getBoundingClientRect();
    const deltaX = e.clientX - dragStartX.value;
    const deltaTime = (deltaX / rect.width) * props.duration;
    
    const segmentDuration = segment.endTime - segment.startTime;
    let newStartTime = dragStartTime.value + deltaTime;
    
    // Clamp to timeline bounds
    newStartTime = Math.max(0, Math.min(newStartTime, props.duration - segmentDuration));
    let newEndTime = newStartTime + segmentDuration;
    
    // Snap to playhead if either edge is within threshold (0.5 seconds)
    const snapThreshold = 0.5;
    if (props.currentTime !== null) {
      // Check if start time should snap to playhead
      if (Math.abs(newStartTime - props.currentTime) < snapThreshold) {
        newStartTime = props.currentTime;
        newEndTime = newStartTime + segmentDuration;
      }
      // Check if end time should snap to playhead
      else if (Math.abs(newEndTime - props.currentTime) < snapThreshold) {
        newEndTime = props.currentTime;
        newStartTime = newEndTime - segmentDuration;
      }
    }
    
    emit('updateSegment', draggingSegmentId.value, { 
      startTime: newStartTime, 
      endTime: newEndTime 
    });
  }

  // Stop dragging
  function stopDrag() {
    isDragging.value = false;
    draggingSegmentId.value = null;
    dragStartX.value = 0;
    dragStartTime.value = 0;
    
    document.removeEventListener('mousemove', onDragMove);
    document.removeEventListener('mouseup', stopDrag);
  }
</script>

<style scoped>
  .poi-segment-timeline {
    min-height: 80px;
  }
</style>
