<template>
  <div class="flex items-center justify-between mb-2 mt-1.5 pr-1 flex-shrink-0">
    <div class="flex items-center gap-1.5">
      <!-- Add Clip & Edit Tools Group -->
      <div class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04]">
        <!-- Add Clip Button -->
        <button
          @click="$emit('toggleAddClipMode')"
          :disabled="!canAddClip"
          :class="[
            'p-1.5 rounded-md transition-all duration-150',
            isAddClipModeActive
              ? 'text-emerald-300 bg-gradient-to-b from-emerald-500/25 to-emerald-600/15 shadow-[0_0_8px_rgba(52,211,153,0.2)]'
              : canAddClip
                ? 'text-white/50 hover:text-emerald-300 hover:bg-emerald-500/15'
                : 'text-white/20 cursor-not-allowed',
          ]"
          :title="
            isAddClipModeActive
              ? 'Add clip mode active - drag to select range'
              : canAddClip
                ? 'Add new clip (N key)'
                : 'Load a video to add clips'
          "
        >
          <Plus :size="14" />
        </button>
        <div class="w-px h-4 bg-white/8 mx-0.5"></div>
        <!-- Cut Button -->
        <button
          @click="$emit('toggleCutTool')"
          :class="[
            'p-1.5 rounded-md transition-all duration-150',
            isCutToolActive
              ? 'text-orange-300 bg-gradient-to-b from-orange-500/25 to-orange-600/15 shadow-[0_0_8px_rgba(251,146,60,0.2)]'
              : 'text-white/50 hover:text-orange-300 hover:bg-orange-500/15',
          ]"
          :title="isCutToolActive ? 'Cut tool active (X to deactivate)' : 'Cut tool (X key)'"
        >
          <Scissors :size="14" />
        </button>
        <!-- Merge Segments Button -->
        <button
          @click="$emit('mergeSegments')"
          :disabled="!canMergeSegments"
          :class="[
            'p-1.5 rounded-md transition-all duration-150',
            canMergeSegments
              ? 'text-violet-300 hover:bg-gradient-to-b hover:from-violet-500/20 hover:to-violet-600/10 hover:shadow-[0_0_8px_rgba(139,92,246,0.15)]'
              : 'text-white/15 cursor-not-allowed',
          ]"
          :title="canMergeSegments ? 'Merge selected segments (J key)' : 'Select multiple segments to merge'"
        >
          <Merge :size="14" />
        </button>
      </div>

      <!-- Playback Controls Group -->
      <div class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04]">
        <button
          @mousedown="$emit('startContinuousSeeking', 'reverse')"
          @mouseup="$emit('stopContinuousSeeking')"
          @mouseleave="$emit('stopContinuousSeeking')"
          @touchstart="$emit('startContinuousSeeking', 'reverse')"
          @touchend="$emit('stopContinuousSeeking')"
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
          @mousedown="$emit('startContinuousSeeking', 'forward')"
          @mouseup="$emit('stopContinuousSeeking')"
          @mouseleave="$emit('stopContinuousSeeking')"
          @touchstart="$emit('startContinuousSeeking', 'forward')"
          @touchend="$emit('stopContinuousSeeking')"
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

    <div class="flex items-center gap-2">
      <span
        v-if="clipCount > 0"
        class="text-[10px] text-white/40 bg-[#161618] border border-white/[0.04] px-2 py-1 rounded-md font-medium"
      >
        {{ clipCount }} clip{{ clipCount !== 1 ? 's' : '' }}
      </span>

      <!-- Zoom Controls Group -->
      <div class="flex items-center gap-0.5 bg-[#161618] rounded-lg px-1.5 py-1 border border-white/[0.04]">
        <button
          @click="zoomOut"
          :disabled="localZoomLevel <= minZoom"
          class="p-1.5 rounded-md transition-all duration-150 text-white/50 hover:text-white hover:bg-white/8 disabled:text-white/15 disabled:cursor-not-allowed disabled:hover:bg-transparent"
          title="Zoom out"
        >
          <Minus :size="14" />
        </button>
        <span class="text-[11px] text-white/50 font-mono tabular-nums min-w-[38px] text-center select-none px-1">
          {{ Math.round(localZoomLevel * 100) }}%
        </span>
        <button
          @click="zoomIn"
          class="p-1.5 rounded-md transition-all duration-150 text-white/50 hover:text-white hover:bg-white/8"
          title="Zoom in"
        >
          <Plus2 :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Plus, Scissors, Merge, Rewind, FastForward, Minus, Plus as Plus2 } from 'lucide-vue-next';

  interface Props {
    isCutToolActive: boolean;
    isAddClipModeActive: boolean;
    canAddClip: boolean;
    isSeeking: boolean;
    seekDirection: 'forward' | 'reverse' | null;
    zoomLevel: number;
    minZoom: number;
    maxZoom: number;
    zoomStep: number;
    clipCount: number;
    canMergeSegments: boolean;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    toggleCutTool: [];
    toggleAddClipMode: [];
    startContinuousSeeking: [direction: 'forward' | 'reverse'];
    stopContinuousSeeking: [];
    zoomChanged: [zoomLevel: number];
    mergeSegments: [];
  }>();

  const localZoomLevel = ref(props.zoomLevel);

  // Keep local zoom level in sync with props
  watch(
    () => props.zoomLevel,
    (newZoomLevel) => {
      localZoomLevel.value = newZoomLevel;
    }
  );

  // Calculate dynamic zoom step based on current zoom level
  // Lower zoom = smaller steps, higher zoom = larger steps
  function getZoomStep(): number {
    if (localZoomLevel.value < 2) return 0.1;
    if (localZoomLevel.value < 5) return 0.25;
    if (localZoomLevel.value < 10) return 0.5;
    if (localZoomLevel.value < 50) return 1;
    if (localZoomLevel.value < 100) return 5;
    return 10;
  }

  function zoomIn() {
    const step = getZoomStep();
    localZoomLevel.value = localZoomLevel.value + step;
    emit('zoomChanged', localZoomLevel.value);
  }

  function zoomOut() {
    const step = getZoomStep();
    const newZoom = Math.max(props.minZoom, localZoomLevel.value - step);
    localZoomLevel.value = newZoom;
    emit('zoomChanged', localZoomLevel.value);
  }
</script>
