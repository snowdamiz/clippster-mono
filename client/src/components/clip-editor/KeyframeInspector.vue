<template>
  <div class="keyframe-inspector">
    <div class="keyframe-inspector__header">
      <h3 class="keyframe-inspector__title">Keyframe</h3>
      <button @click="$emit('delete')" class="keyframe-inspector__delete" title="Delete Keyframe">
        <Trash2 :size="14" />
      </button>
    </div>

    <div class="keyframe-inspector__content">
      <!-- Property Name (Read-only) -->
      <div class="keyframe-inspector__field">
        <label class="keyframe-inspector__label">Property</label>
        <div class="keyframe-inspector__readonly">
          {{ formatProperty(keyframe.property) }}
        </div>
      </div>

      <!-- Time -->
      <div class="keyframe-inspector__field">
        <label class="keyframe-inspector__label">Time (s)</label>
        <div class="keyframe-inspector__input-group">
          <input
            type="number"
            v-model.number="localTime"
            step="0.1"
            class="keyframe-inspector__input"
            @change="updateKeyframe"
          />
        </div>
      </div>

      <!-- Value -->
      <div class="keyframe-inspector__field">
        <label class="keyframe-inspector__label">Value</label>
        <div class="keyframe-inspector__input-group">
          <input
            type="number"
            v-model.number="localValue"
            :step="getValueStep(keyframe.property)"
            class="keyframe-inspector__input"
            @change="updateKeyframe"
          />
          <span class="keyframe-inspector__unit">{{ getValueUnit(keyframe.property) }}</span>
        </div>
        <!-- Slider for common ranged values -->
        <input
          v-if="hasRange(keyframe.property)"
          type="range"
          v-model.number="localValue"
          :min="getMin(keyframe.property)"
          :max="getMax(keyframe.property)"
          :step="getValueStep(keyframe.property)"
          class="keyframe-inspector__slider"
          @input="updateKeyframe"
        />
      </div>

      <!-- Easing -->
      <div class="keyframe-inspector__field">
        <label class="keyframe-inspector__label">Easing</label>
        <div class="keyframe-inspector__easing-grid">
          <button
            v-for="ease in easingTypes"
            :key="ease"
            @click="setEasing(ease)"
            :class="[
              'keyframe-inspector__easing-button',
              localEasing === ease ? 'keyframe-inspector__easing-button--active' : '',
            ]"
            :title="ease"
          >
            {{ formatEasing(ease) }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch } from 'vue';
  import { Trash2 } from 'lucide-vue-next';
  import type { Keyframe, AnimationProperty, EasingType } from '@/types/timeline-model';

  const props = defineProps<{
    keyframe: Keyframe;
  }>();

  const emit = defineEmits<{
    (e: 'update', updates: Partial<Keyframe>): void;
    (e: 'delete'): void;
  }>();

  // Local state for immediate feedback
  const localTime = ref(props.keyframe.time);
  const localValue = ref(props.keyframe.value);
  const localEasing = ref(props.keyframe.easing || 'linear');

  // Sync local state when prop changes (e.g. selecting different keyframe)
  watch(
    () => props.keyframe,
    (newVal) => {
      localTime.value = newVal.time;
      localValue.value = newVal.value;
      localEasing.value = newVal.easing || 'linear';
    },
    { deep: true }
  );

  const easingTypes: EasingType[] = ['linear', 'ease-in', 'ease-out', 'ease-in-out', 'step', 'bezier'];

  function updateKeyframe() {
    emit('update', {
      time: localTime.value,
      value: localValue.value,
      easing: localEasing.value,
    });
  }

  function setEasing(easing: EasingType) {
    localEasing.value = easing;
    updateKeyframe();
  }

  // Helpers
  function formatProperty(prop: string): string {
    return prop.replace(/_/g, ' ');
  }

  function formatEasing(easing: string): string {
    if (easing === 'ease-in-out') return 'In-Out';
    return easing.charAt(0).toUpperCase() + easing.slice(1);
  }

  function getValueUnit(prop: AnimationProperty): string {
    if (['rotation'].includes(prop)) return '°';
    if (['opacity', 'volume', 'blur', 'brightness', 'contrast', 'saturation'].includes(prop)) return '%';
    if (['scale'].includes(prop)) return 'x';
    if (['position_x', 'position_y'].includes(prop)) return 'px';
    return '';
  }

  function getValueStep(prop: AnimationProperty): number {
    if (['opacity', 'volume'].includes(prop)) return 0.01;
    if (['scale'].includes(prop)) return 0.1;
    if (['rotation'].includes(prop)) return 1; // degrees
    return 1;
  }

  function hasRange(prop: AnimationProperty): boolean {
    return ['opacity', 'volume', 'scale', 'rotation', 'blur', 'brightness', 'contrast', 'saturation'].includes(prop);
  }

  function getMin(prop: AnimationProperty): number {
    if (['opacity', 'volume', 'blur'].includes(prop)) return 0;
    if (['brightness', 'contrast', 'saturation'].includes(prop)) return 0; // usually 0% to ...
    if (['scale'].includes(prop)) return 0;
    if (['rotation'].includes(prop)) return -360;
    return 0;
  }

  function getMax(prop: AnimationProperty): number {
    if (['opacity', 'volume'].includes(prop)) return 1;
    if (['blur'].includes(prop)) return 100; // arbitrary blur max
    if (['brightness', 'contrast', 'saturation'].includes(prop)) return 2; // 200%
    if (['scale'].includes(prop)) return 5;
    if (['rotation'].includes(prop)) return 360;
    return 100;
  }
</script>

<style scoped>
  .keyframe-inspector {
    display: flex;
    flex-direction: column;
    gap: 1rem;
    padding: 1rem;
    background-color: rgba(0, 0, 0, 0.3);
    border: 1px solid rgba(255, 255, 255, 0.05);
    border-radius: 6px;
  }

  .keyframe-inspector__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .keyframe-inspector__title {
    font-size: 0.875rem;
    font-weight: 500;
    color: rgba(255, 255, 255, 0.9);
    margin: 0;
  }

  .keyframe-inspector__delete {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0.375rem;
    color: #f87171;
    background: transparent;
    border: none;
    border-radius: 4px;
    cursor: pointer;
    transition: background-color 150ms ease;
  }

  .keyframe-inspector__delete:hover {
    background-color: rgba(239, 68, 68, 0.1);
  }

  .keyframe-inspector__content {
    display: flex;
    flex-direction: column;
    gap: 0.75rem;
  }

  .keyframe-inspector__field {
    display: flex;
    flex-direction: column;
    gap: 0.375rem;
  }

  .keyframe-inspector__label {
    font-size: 0.6875rem;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: rgba(255, 255, 255, 0.4);
    font-weight: 600;
  }

  .keyframe-inspector__readonly {
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 0.7);
    font-family: ui-monospace, monospace;
    background-color: rgba(0, 0, 0, 0.2);
    padding: 0.375rem 0.5rem;
    border-radius: 4px;
    border: 1px solid rgba(255, 255, 255, 0.05);
  }

  .keyframe-inspector__input-group {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .keyframe-inspector__input {
    background-color: rgba(0, 0, 0, 0.2);
    border: 1px solid rgba(255, 255, 255, 0.1);
    border-radius: 4px;
    padding: 0.375rem 0.5rem;
    font-size: 0.75rem;
    color: rgba(255, 255, 255, 1);
    width: 100%;
  }

  .keyframe-inspector__input:focus {
    outline: none;
    border-color: rgba(139, 92, 246, 0.5);
  }

  .keyframe-inspector__unit {
    font-size: 0.625rem;
    color: rgba(255, 255, 255, 0.3);
    width: 2rem;
    text-align: right;
  }

  .keyframe-inspector__slider {
    width: 100%;
    height: 0.25rem;
    background-color: rgba(255, 255, 255, 0.1);
    border-radius: 9999px;
    appearance: none;
    cursor: pointer;
    accent-color: #8b5cf6;
  }

  .keyframe-inspector__slider::-webkit-slider-thumb {
    appearance: none;
    width: 0.75rem;
    height: 0.75rem;
    border-radius: 9999px;
    background-color: #8b5cf6;
  }

  .keyframe-inspector__easing-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 0.25rem;
  }

  .keyframe-inspector__easing-button {
    font-size: 0.625rem;
    padding: 0.375rem 0.5rem;
    border-radius: 4px;
    border: 1px solid;
    background: transparent;
    text-align: center;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;
    transition: all 150ms ease;
    background-color: rgba(0, 0, 0, 0.2);
    border-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.5);
  }

  .keyframe-inspector__easing-button:hover {
    background-color: rgba(255, 255, 255, 0.05);
    color: rgba(255, 255, 255, 0.8);
  }

  .keyframe-inspector__easing-button--active {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.15) 100%);
    border-color: rgba(139, 92, 246, 0.5);
    color: #c4b5fd;
  }
</style>
