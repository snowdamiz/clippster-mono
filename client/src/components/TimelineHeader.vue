<template>
  <div class="flex items-center justify-between mb-3 pr-1 flex-shrink-0">
    <div class="flex items-center gap-2">
      <!-- Timeline Toolbar -->
      <div class="flex items-center gap-0.5 bg-black/40 backdrop-blur-sm rounded-lg p-1 border border-white/[0.04]">
        <!-- Add Clip Button -->
        <button
          @click="$emit('toggleAddClipMode')"
          :disabled="!canAddClip"
          :class="[
            'p-1.5 rounded-md transition-all duration-150 group',
            isAddClipModeActive
              ? 'text-emerald-400 bg-emerald-500/20 shadow-sm shadow-emerald-500/10'
              : canAddClip
                ? 'text-white/50 hover:text-emerald-400 hover:bg-emerald-500/10'
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
        <!-- Separator -->
        <div class="w-px h-4 bg-white/10 mx-0.5"></div>
        <!-- Cut Button -->
        <button
          @click="$emit('toggleCutTool')"
          :class="[
            'p-1.5 rounded-md transition-all duration-150',
            isCutToolActive
              ? 'text-sky-400 bg-sky-500/20 shadow-sm shadow-sky-500/10'
              : 'text-white/50 hover:text-sky-400 hover:bg-sky-500/10',
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
            canMergeSegments ? 'text-violet-400 hover:bg-violet-500/15' : 'text-white/20 cursor-not-allowed',
          ]"
          :title="canMergeSegments ? 'Merge selected segments (J key)' : 'Select multiple segments to merge'"
        >
          <Merge :size="14" />
        </button>
        <!-- Separator -->
        <div class="w-px h-4 bg-white/10 mx-0.5"></div>
        <!-- Reverse 10 Seconds Button -->
        <button
          @mousedown="$emit('startContinuousSeeking', 'reverse')"
          @mouseup="$emit('stopContinuousSeeking')"
          @mouseleave="$emit('stopContinuousSeeking')"
          @touchstart="$emit('startContinuousSeeking', 'reverse')"
          @touchend="$emit('stopContinuousSeeking')"
          :class="[
            'p-1.5 rounded-md transition-colors duration-150',
            isSeeking && seekDirection === 'reverse'
              ? 'text-amber-400 bg-amber-500/20'
              : 'text-white/50 hover:text-amber-400 hover:bg-amber-500/10',
          ]"
          :title="'Seek backward (← arrow key)'"
        >
          <Rewind :size="14" />
        </button>
        <!-- Fast Forward 10 Seconds Button -->
        <button
          @mousedown="$emit('startContinuousSeeking', 'forward')"
          @mouseup="$emit('stopContinuousSeeking')"
          @mouseleave="$emit('stopContinuousSeeking')"
          @touchstart="$emit('startContinuousSeeking', 'forward')"
          @touchend="$emit('stopContinuousSeeking')"
          :class="[
            'p-1.5 rounded-md transition-colors duration-150',
            isSeeking && seekDirection === 'forward'
              ? 'text-amber-400 bg-amber-500/20'
              : 'text-white/50 hover:text-amber-400 hover:bg-amber-500/10',
          ]"
          :title="'Seek forward (→ arrow key)'"
        >
          <FastForward :size="14" />
        </button>
      </div>
      <!-- Zoom Slider -->
      <div
        class="flex items-center gap-2 bg-black/40 backdrop-blur-sm rounded-lg px-2.5 py-2 border border-white/[0.04]"
      >
        <ZoomIn :size="18" class="text-white/40" />
        <input
          ref="zoomSlider"
          type="range"
          :min="minZoom"
          :max="maxZoom"
          :step="zoomStep"
          v-model="localZoomLevel"
          class="w-20 h-1 bg-white/10 rounded-full appearance-none cursor-pointer slider-zoom"
          @input="handleZoomChange"
        />
        <span class="text-[12px] text-white/50 text-right font-mono tabular-nums">
          {{ Math.round(zoomLevel * 100) }}%
        </span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span v-if="clipCount > 0" class="text-[10px] text-white/40 bg-white/[0.04] px-2 py-1 rounded-md">
        {{ clipCount }} clip{{ clipCount !== 1 ? 's' : '' }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Plus, Scissors, Merge, Rewind, FastForward, ZoomIn } from 'lucide-vue-next';

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

  const zoomSlider = ref<HTMLInputElement | null>(null);
  const localZoomLevel = ref(props.zoomLevel);

  // Keep local zoom level in sync with props
  watch(
    () => props.zoomLevel,
    (newZoomLevel) => {
      localZoomLevel.value = newZoomLevel;
    }
  );

  const handleZoomChange = () => {
    emit('zoomChanged', localZoomLevel.value);
  };

  defineExpose({
    zoomSlider,
  });
</script>

<style scoped>
  /* Zoom slider styling */
  .slider-zoom {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    transition: opacity 0.2s;
  }

  /* Base track styling */
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

  .slider-zoom:active::-webkit-slider-thumb {
    transform: scale(1.1);
  }

  .slider-zoom:active::-moz-range-thumb {
    transform: scale(1.1);
  }
</style>
