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
    <div class="px-3 py-2">
      <div class="relative h-12 bg-zinc-950 rounded border border-zinc-800">
        <!-- Time markers -->
        <div class="absolute inset-0 flex items-center justify-between px-2 text-[9px] text-zinc-600 font-mono pointer-events-none">
          <span>0:00</span>
          <span>{{ formatTime(duration) }}</span>
        </div>

        <!-- Segments -->
        <div
          v-for="segment in segments"
          :key="segment.segmentId"
          class="absolute top-0 bottom-0 border-l-2 border-r-2 cursor-pointer transition-colors"
          :class="{
            'bg-blue-500/20 border-blue-500': activeSegmentId === segment.segmentId,
            'bg-zinc-700/30 border-zinc-600 hover:bg-zinc-700/40': activeSegmentId !== segment.segmentId,
          }"
          :style="getSegmentStyle(segment)"
          @click="selectSegment(segment.segmentId)"
        >
          <!-- Segment label -->
          <div class="absolute inset-0 flex items-center justify-center text-[9px] font-medium pointer-events-none"
            :class="activeSegmentId === segment.segmentId ? 'text-blue-300' : 'text-zinc-400'"
          >
            {{ formatTime(segment.startTime) }} - {{ formatTime(segment.endTime) }}
          </div>

          <!-- Delete button -->
          <button
            v-if="segments.length > 1"
            @click.stop="deleteSegment(segment.segmentId)"
            class="absolute -top-1 -right-1 w-4 h-4 bg-red-500 hover:bg-red-600 rounded-full flex items-center justify-center text-white opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete segment"
          >
            <XIcon class="w-2.5 h-2.5" />
          </button>
        </div>

        <!-- Playhead indicator -->
        <div
          v-if="currentTime !== null"
          class="absolute top-0 bottom-0 w-0.5 bg-white pointer-events-none z-10"
          :style="{ left: `${(currentTime / duration) * 100}%` }"
        >
          <div class="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
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
  import { computed } from 'vue';
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
  }>();

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
</script>

<style scoped>
  .poi-segment-timeline {
    min-height: 80px;
  }
</style>
