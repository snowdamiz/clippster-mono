<template>
  <div class="flex h-8 shrink-0 items-center justify-between gap-3">
    <div class="flex min-w-0 items-center gap-0.5">
      <!-- Edit tools -->
      <TimelineToolButton
        :active="isAddClipModeActive"
        :disabled="!canAddClip"
        :title="
          isAddClipModeActive
            ? 'Add clip mode active - drag to select range'
            : canAddClip
              ? 'Add new clip (N key)'
              : 'Load a video to add clips'
        "
        aria-label="Add clip"
        @click="$emit('toggleAddClipMode')"
      >
        <template #icon><Plus /></template>
      </TimelineToolButton>
      <TimelineToolButton
        :active="isCutToolActive"
        :title="isCutToolActive ? 'Cut tool active (X to deactivate)' : 'Cut tool (X key)'"
        aria-label="Cut tool"
        @click="$emit('toggleCutTool')"
      >
        <template #icon><Scissors /></template>
      </TimelineToolButton>
      <TimelineToolButton
        :disabled="!canMergeSegments"
        :title="canMergeSegments ? 'Merge selected segments (J key)' : 'Select multiple segments to merge'"
        aria-label="Merge segments"
        @click="$emit('mergeSegments')"
      >
        <template #icon><Merge /></template>
      </TimelineToolButton>

      <span class="mx-1.5 h-4 w-px shrink-0 bg-line" aria-hidden="true" />

      <!-- Seek -->
      <TimelineToolButton
        :active="isSeeking && seekDirection === 'reverse'"
        title="Seek backward (← arrow key)"
        aria-label="Seek backward"
        @mousedown="$emit('startContinuousSeeking', 'reverse')"
        @mouseup="$emit('stopContinuousSeeking')"
        @mouseleave="$emit('stopContinuousSeeking')"
        @touchstart="$emit('startContinuousSeeking', 'reverse')"
        @touchend="$emit('stopContinuousSeeking')"
      >
        <template #icon><Rewind /></template>
      </TimelineToolButton>
      <TimelineToolButton
        :active="isSeeking && seekDirection === 'forward'"
        title="Seek forward (→ arrow key)"
        aria-label="Seek forward"
        @mousedown="$emit('startContinuousSeeking', 'forward')"
        @mouseup="$emit('stopContinuousSeeking')"
        @mouseleave="$emit('stopContinuousSeeking')"
        @touchstart="$emit('startContinuousSeeking', 'forward')"
        @touchend="$emit('stopContinuousSeeking')"
      >
        <template #icon><FastForward /></template>
      </TimelineToolButton>

      <span class="mx-1.5 h-4 w-px shrink-0 bg-line" aria-hidden="true" />

      <!-- Overlays -->
      <TimelineToolButton
        :disabled="clipCount === 0"
        :title="clipCount > 0 ? 'Add or edit subtitles' : 'Add clips to enable subtitles'"
        @click="$emit('toggleSubtitles')"
      >
        <template #icon><Captions /></template>
        Subtitles
      </TimelineToolButton>
      <TimelineToolButton
        :disabled="clipCount === 0"
        :title="clipCount > 0 ? 'Add a text box to the current clip (click the box on the video to edit)' : 'Add clips to enable text'"
        @click="$emit('toggleText')"
      >
        <template #icon><Type /></template>
        Text
      </TimelineToolButton>
    </div>

    <div class="flex shrink-0 items-center gap-3">
      <span v-if="clipCount > 0" class="tabular text-2xs font-medium text-fg-subtle">
        {{ clipCount }} clip{{ clipCount !== 1 ? 's' : '' }}
      </span>

      <!-- Zoom -->
      <div class="flex items-center gap-0.5">
        <TimelineToolButton :disabled="localSliderPosition <= 0" title="Zoom out" aria-label="Zoom out" @click="zoomOut">
          <template #icon><Minus /></template>
        </TimelineToolButton>
        <span class="tabular w-10 select-none text-center text-2xs font-medium text-fg-muted">
          {{ Math.round(localSliderPosition * 100) }}%
        </span>
        <TimelineToolButton :disabled="localSliderPosition >= 1" title="Zoom in" aria-label="Zoom in" @click="zoomIn">
          <template #icon><Plus2 /></template>
        </TimelineToolButton>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Plus, Scissors, Merge, Rewind, FastForward, Minus, Plus as Plus2, Captions, Type } from 'lucide-vue-next';
  import TimelineToolButton from './TimelineToolButton.vue';

  interface Props {
    isCutToolActive: boolean;
    isAddClipModeActive: boolean;
    canAddClip: boolean;
    isSeeking: boolean;
    seekDirection: 'forward' | 'reverse' | null;
    /** Slider position 0-1 (0% to 100%) */
    sliderPosition: number;
    clipCount: number;
    canMergeSegments: boolean;
  }

  const props = defineProps<Props>();

  const emit = defineEmits<{
    toggleCutTool: [];
    toggleAddClipMode: [];
    startContinuousSeeking: [direction: 'forward' | 'reverse'];
    stopContinuousSeeking: [];
    sliderChanged: [value: number];
    mergeSegments: [];
    toggleSubtitles: [];
    toggleText: [];
  }>();

  const localSliderPosition = ref(props.sliderPosition);

  // Keep local slider position in sync with props
  watch(
    () => props.sliderPosition,
    (newSliderPosition) => {
      localSliderPosition.value = newSliderPosition;
    }
  );

  // Fixed slider step for consistent button behavior
  const SLIDER_STEP = 0.05; // 5% per click

  function zoomIn() {
    const newSlider = Math.min(1, localSliderPosition.value + SLIDER_STEP);
    localSliderPosition.value = newSlider;
    emit('sliderChanged', newSlider);
  }

  function zoomOut() {
    const newSlider = Math.max(0, localSliderPosition.value - SLIDER_STEP);
    localSliderPosition.value = newSlider;
    emit('sliderChanged', newSlider);
  }
</script>
