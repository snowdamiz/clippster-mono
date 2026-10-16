<script setup lang="ts">
  /**
   * Volume slider for the livestream players (watch dialog, PiP overlay,
   * PiP window). A native range input whose track fills up to the value;
   * listeners like `@input` fall through to the <input>.
   */
  import { computed } from 'vue'

  const props = withDefaults(defineProps<{ value: number; step?: number | string }>(), { step: 0.05 })

  const fill = computed(() => `${Math.min(100, Math.max(0, props.value * 100))}%`)
</script>

<template>
  <input
    type="range"
    min="0"
    max="1"
    :step="step"
    :value="value"
    class="media-volume"
    :style="{ '--media-volume-fill': fill }"
    aria-label="Volume"
  />
</template>

<style scoped>
  .media-volume {
    height: 16px;
  }
  .media-volume::-webkit-slider-runnable-track {
    height: 3px;
    border-radius: 999px;
    background: linear-gradient(
      to right,
      #fff 0,
      #fff var(--media-volume-fill),
      rgba(255, 255, 255, 0.25) var(--media-volume-fill)
    );
  }
  .media-volume::-webkit-slider-thumb {
    width: 11px;
    height: 11px;
    margin-top: -4px;
    background: #fff;
  }
  .media-volume::-moz-range-track {
    height: 3px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.25);
  }
  .media-volume::-moz-range-progress {
    height: 3px;
    border-radius: 999px;
    background: #fff;
  }
  .media-volume::-moz-range-thumb {
    width: 11px;
    height: 11px;
    border: none;
    border-radius: 50%;
    background: #fff;
  }
</style>
