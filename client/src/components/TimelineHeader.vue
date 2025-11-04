<template>
  <div class="flex items-center justify-between mb-3 pr-1 flex-shrink-0">
    <div class="flex items-center gap-2">
      <!-- Timeline Toolbar -->
      <div class="flex items-center gap-1 bg-muted/30 rounded-lg">
        <!-- Cut Button -->
        <button
          @click="$emit('toggleCutTool')"
          :class="[
            'p-1.5 rounded transition-all duration-150',
            isCutToolActive
              ? 'text-blue-600 bg-blue-100/20 hover:bg-blue-100/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          ]"
          :title="isCutToolActive ? 'Cut tool active (click to deactivate)' : 'Cut tool (click to activate)'"
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M14.121 14.121L19 19m-7-7l7-7m-7 7l-2.879 2.879M12 12L9.121 9.121m0 5.758a3 3 0 1 0 4.243 4.243 3 3 0 0 0-4.243-4.243zm0-5.758a3 3 0 1 0 4.243-4.243 3 3 0 0 0-4.243 4.243z"
            />
          </svg>
        </button>
        <!-- Reverse 10 Seconds Button -->
        <button
          @mousedown="$emit('startContinuousSeeking', 'reverse')"
          @mouseup="$emit('stopContinuousSeeking')"
          @mouseleave="$emit('stopContinuousSeeking')"
          @touchstart="$emit('startContinuousSeeking', 'reverse')"
          @touchend="$emit('stopContinuousSeeking')"
          :class="[
            'p-1.5 rounded transition-colors duration-150',
            isSeeking && seekDirection === 'reverse'
              ? 'text-blue-600 bg-blue-100/20 hover:bg-blue-100/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          ]"
          :title="
            isSeeking && seekDirection === 'reverse'
              ? 'Seeking 2x speed (release to stop)'
              : 'Reverse 10 seconds (← arrow key)'
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M12.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0019 16V8a1 1 0 00-1.6-.8l-5.333 4zM4.066 11.2a1 1 0 000 1.6l5.334 4A1 1 0 0011 16V8a1 1 0 00-1.6-.8l-5.334 4z"
            />
          </svg>
        </button>
        <!-- Fast Forward 10 Seconds Button -->
        <button
          @mousedown="$emit('startContinuousSeeking', 'forward')"
          @mouseup="$emit('stopContinuousSeeking')"
          @mouseleave="$emit('stopContinuousSeeking')"
          @touchstart="$emit('startContinuousSeeking', 'forward')"
          @touchend="$emit('stopContinuousSeeking')"
          :class="[
            'p-1.5 rounded transition-colors duration-150',
            isSeeking && seekDirection === 'forward'
              ? 'text-blue-600 bg-blue-100/20 hover:bg-blue-100/30'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
          ]"
          :title="
            isSeeking && seekDirection === 'forward'
              ? 'Seeking 2x speed (release to stop)'
              : 'Fast forward 10 seconds (→ arrow key)'
          "
        >
          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              stroke-width="2"
              d="M11.933 12.8a1 1 0 000-1.6L6.6 7.2A1 1 0 005 8v8a1 1 0 001.6.8l5.333-4zM19.933 12.8a1 1 0 000-1.6l-5.333-4A1 1 0 0013 8v8a1 1 0 001.6.8l5.333-4z"
            />
          </svg>
        </button>
      </div>
      <!-- Zoom Slider -->
      <div class="flex items-center gap-2 bg-muted/30 rounded-lg px-2.5 py-1.5">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-3 w-3 text-muted-foreground/70"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7"
          />
        </svg>
        <input
          ref="zoomSlider"
          type="range"
          :min="minZoom"
          :max="maxZoom"
          :step="zoomStep"
          v-model="localZoomLevel"
          class="w-20 h-1 bg-muted-foreground/30 rounded-lg appearance-none cursor-pointer slider-zoom"
          @input="handleZoomChange"
        />
        <span class="text-xs text-muted-foreground/70 min-w-[2rem] text-right">{{ Math.round(zoomLevel * 100) }}%</span>
      </div>
    </div>

    <div class="flex items-center gap-2">
      <span v-if="clipCount > 0" class="text-xs text-muted-foreground">{{ clipCount }} clips</span>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue'

  interface Props {
    isCutToolActive: boolean
    isSeeking: boolean
    seekDirection: 'forward' | 'reverse' | null
    zoomLevel: number
    minZoom: number
    maxZoom: number
    zoomStep: number
    clipCount: number
  }

  const props = defineProps<Props>()

  const emit = defineEmits<{
    toggleCutTool: []
    startContinuousSeeking: [direction: 'forward' | 'reverse']
    stopContinuousSeeking: []
    zoomChanged: [zoomLevel: number]
  }>()

  const zoomSlider = ref<HTMLInputElement | null>(null)
  const localZoomLevel = ref(props.zoomLevel)

  // Keep local zoom level in sync with props
  watch(
    () => props.zoomLevel,
    (newZoomLevel) => {
      localZoomLevel.value = newZoomLevel
    }
  )

  const handleZoomChange = () => {
    emit('zoomChanged', localZoomLevel.value)
  }

  defineExpose({
    zoomSlider
  })
</script>

<style scoped>
  /* Zoom slider styling */
  .slider-zoom {
    -webkit-appearance: none;
    appearance: none;
    outline: none;
    transition: opacity 0.2s;
  }

  /* Base track styling - will be updated by JavaScript */
  .slider-zoom::-webkit-slider-track {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.2);
  }

  .slider-zoom::-moz-range-track {
    width: 100%;
    height: 4px;
    border-radius: 2px;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.2);
  }

  .slider-zoom::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider-zoom::-moz-range-thumb {
    width: 12px;
    height: 12px;
    background: white;
    border-radius: 50%;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider-zoom:hover::-webkit-slider-thumb {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider-zoom:hover::-moz-range-thumb {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider-zoom:active::-webkit-slider-thumb {
    transform: scale(1.1);
  }

  .slider-zoom:active::-moz-range-thumb {
    transform: scale(1.1);
  }
</style>
