<template>
  <div class="poi-segment-timeline border-t border-zinc-800 bg-zinc-900/70">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-zinc-700/50">
      <div class="flex items-center gap-2">
        <div class="text-xs font-medium text-zinc-300">Segments</div>
        <span class="text-[10px] text-zinc-500">{{ segments.length }} segment{{ segments.length !== 1 ? 's' : '' }}</span>
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
        class="relative h-12 bg-zinc-900/50 rounded-lg border border-zinc-800/50 cursor-crosshair overflow-visible"
        @click="onTimelineClick"
      >
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
            v-if="segments.length > 1"
            @click.stop="deleteSegment(segment.segmentId)"
            class="absolute -top-3 -right-2 w-6 h-6 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-all shadow-lg hover:scale-110"
            title="Delete segment"
          >
            <XIcon class="w-3.5 h-3.5" />
          </button>
        </div>

        <!-- Playhead indicator -->
        <div
          v-if="currentTime !== null"
          class="absolute top-0 bottom-0 w-0.5 bg-white/90 pointer-events-none z-20 shadow-lg"
          :style="{ left: `${(currentTime / duration) * 100}%` }"
        >
          <div class="absolute -top-1.5 left-1/2 -translate-x-1/2 w-3 h-3 bg-white rounded-full shadow-lg border-2 border-zinc-900" />
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
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    addSegment: [];
    deleteSegment: [segmentId: string];
    selectSegment: [segmentId: string];
    updateSegment: [segmentId: string, updates: { startTime?: number; endTime?: number }];
  }>();

  const timelineRef = ref<HTMLElement | null>(null);
  const isResizing = ref(false);
  const resizingSegmentId = ref<string | null>(null);
  const resizingEdge = ref<'start' | 'end' | null>(null);
  
  const isDragging = ref(false);
  const draggingSegmentId = ref<string | null>(null);
  const dragStartX = ref(0);
  const dragStartTime = ref(0);

  // Get active segment
  const activeSegment = computed(() => {
    return props.segments.find(s => s.segmentId === props.activeSegmentId) || null;
  });

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

  // Click timeline to create segment at that position
  function onTimelineClick(e: MouseEvent) {
    if (!timelineRef.value || isResizing.value) return;
    
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
      // Create new segment at click position
      addSegment();
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
    const newTime = mousePercent * props.duration;
    
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
    const newEndTime = newStartTime + segmentDuration;
    
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
