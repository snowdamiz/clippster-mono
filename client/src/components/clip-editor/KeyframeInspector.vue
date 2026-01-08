<template>
  <div class="flex flex-col gap-4 p-4 bg-[#1e1e1e] rounded-md border border-white/5">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-medium text-white/90">Keyframe</h3>
      <button
        @click="$emit('delete')"
        class="p-1.5 text-red-400 hover:bg-red-500/10 rounded transition-colors"
        title="Delete Keyframe"
      >
        <Trash2 :size="14" />
      </button>
    </div>

    <div class="space-y-3">
      <!-- Property Name (Read-only) -->
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] uppercase tracking-wider text-white/40 font-semibold">Property</label>
        <div class="text-xs text-white/70 font-mono bg-black/20 px-2 py-1.5 rounded border border-white/5">
          {{ formatProperty(keyframe.property) }}
        </div>
      </div>

      <!-- Time -->
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] uppercase tracking-wider text-white/40 font-semibold">Time (s)</label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            v-model.number="localTime"
            step="0.1"
            class="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-violet-500/50 focus:outline-none w-full"
            @change="updateKeyframe"
          />
        </div>
      </div>

      <!-- Value -->
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] uppercase tracking-wider text-white/40 font-semibold">Value</label>
        <div class="flex items-center gap-2">
          <input
            type="number"
            v-model.number="localValue"
            :step="getValueStep(keyframe.property)"
            class="bg-black/20 border border-white/10 rounded px-2 py-1.5 text-xs text-white focus:border-violet-500/50 focus:outline-none w-full"
            @change="updateKeyframe"
          />
          <span class="text-[10px] text-white/30 w-8 text-right">{{ getValueUnit(keyframe.property) }}</span>
        </div>
        <!-- Slider for common ranged values -->
        <input
          v-if="hasRange(keyframe.property)"
          type="range"
          v-model.number="localValue"
          :min="getMin(keyframe.property)"
          :max="getMax(keyframe.property)"
          :step="getValueStep(keyframe.property)"
          class="w-full accent-violet-500 h-1 bg-white/10 rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-violet-500"
          @input="updateKeyframe"
        />
      </div>

      <!-- Easing -->
      <div class="flex flex-col gap-1.5">
        <label class="text-[11px] uppercase tracking-wider text-white/40 font-semibold">Easing</label>
        <div class="grid grid-cols-3 gap-1">
          <button
            v-for="ease in easingTypes"
            :key="ease"
            @click="setEasing(ease)"
            class="text-[10px] px-2 py-1.5 rounded border transition-all duration-150 text-center truncate"
            :class="
              localEasing === ease
                ? 'bg-violet-500/20 border-violet-500/50 text-violet-200'
                : 'bg-black/20 border-white/5 text-white/50 hover:bg-white/5 hover:text-white/80'
            "
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
