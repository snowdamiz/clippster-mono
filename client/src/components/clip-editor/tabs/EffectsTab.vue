<template>
  <div class="space-y-4">
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 p-1 bg-white/5 rounded-lg">
      <button
        @click="activeSubTab = 'transitions'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'transitions'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Shuffle :size="12" />
        Transitions
      </button>
      <button
        @click="activeSubTab = 'effects'"
        :class="[
          'flex-1 px-3 py-1.5 text-xs font-medium rounded-md transition-colors flex items-center justify-center gap-1.5',
          activeSubTab === 'effects'
            ? 'bg-violet-500/20 text-violet-300'
            : 'text-white/50 hover:text-white/70',
        ]"
      >
        <Sparkles :size="12" />
        Effects
      </button>
    </div>

    <!-- Transitions Sub-tab -->
    <div v-if="activeSubTab === 'transitions'" class="space-y-4">
      <p class="text-xs text-white/50">
        Hover to preview, click to select.
      </p>

      <!-- Transition Categories -->
      <div v-for="category in transitionCategories" :key="category.category" class="space-y-2">
        <button
          @click="toggleCategory('transition', category.category)"
          class="flex items-center justify-between w-full text-left"
        >
          <span class="text-xs font-medium text-white/70">{{ category.label }}</span>
          <ChevronDown
            :size="14"
            class="text-white/40 transition-transform"
            :class="{ 'rotate-180': expandedCategories.has(`transition-${category.category}`) }"
          />
        </button>
        
        <div
          v-if="expandedCategories.has(`transition-${category.category}`)"
          class="grid grid-cols-3 gap-2"
        >
          <button
            v-for="preset in category.presets"
            :key="preset.type"
            @click="selectTransition(preset)"
            @mouseenter="previewItem(preset, 'transition')"
            @mouseleave="clearPreview"
            class="p-2 rounded-lg border border-white/10 bg-white/5 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all text-center group relative overflow-hidden"
            :class="{ 'border-violet-500 bg-violet-500/20': selectedTransition?.type === preset.type }"
          >
            <!-- Hover Video Preview -->
            <div 
              v-if="hoveredItem?.name === preset.name && hoveredType === 'transition'"
              class="w-full aspect-video bg-black rounded mb-1.5 overflow-hidden relative"
            >
              <video
                src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
                class="w-full h-full object-cover"
                autoplay
                muted
                loop
                playsinline
                :style="previewStyle(preset)"
              ></video>
            </div>

            <!-- Static Thumbnail -->
            <div 
              v-else
              class="w-full aspect-video bg-cover bg-center rounded mb-1.5 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105"
              :style="{ 
                backgroundImage: `url('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.jpg')`,
                opacity: selectedTransition?.type === preset.type ? 1 : 0.7
              }"
            >
              <div class="absolute inset-0 bg-black/20 group-hover:bg-transparent transition-colors"></div>
              <Shuffle :size="16" class="text-white drop-shadow-md relative z-10" />
            </div>
            
            <span class="text-[10px] text-white/70 group-hover:text-white transition-colors line-clamp-1 relative z-10">
              {{ preset.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- Selected Transition Settings -->
      <div v-if="selectedTransition" class="p-3 bg-white/5 rounded-lg border border-violet-500/30 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-white">{{ selectedTransition.name }}</span>
          <button @click="selectedTransition = null" class="text-white/40 hover:text-white/70">
            <X :size="14" />
          </button>
        </div>
        
        <div>
          <label class="block text-xs text-white/60 mb-1">Duration (seconds)</label>
          <input
            type="number"
            v-model.number="transitionDuration"
            min="0.1"
            max="3"
            step="0.1"
            class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white"
          />
        </div>

        <button
          @click="applyTransition"
          class="w-full py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Apply to Selected Segment
        </button>
      </div>

      <!-- Applied Transitions List -->
      <div v-if="appliedTransitions.length > 0" class="space-y-2">
        <h4 class="text-xs font-medium text-white/70">Applied Transitions</h4>
        <div
          v-for="transition in appliedTransitions"
          :key="transition.id"
          class="flex items-center justify-between p-2 bg-white/5 rounded-lg"
        >
          <div class="flex items-center gap-2">
            <Shuffle :size="12" class="text-violet-400" />
            <span class="text-xs text-white">{{ transition.transitionType }}</span>
            <span class="text-[10px] text-white/40">{{ transition.duration }}s</span>
          </div>
          <button
            @click="emit('deleteTransition', transition.id)"
            class="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <Trash2 :size="12" class="text-red-400" />
          </button>
        </div>
      </div>
    </div>

    <!-- Effects Sub-tab -->
    <div v-if="activeSubTab === 'effects'" class="space-y-4">
      <p class="text-xs text-white/50">
        Hover to preview. Click to apply to timeline.
      </p>

      <!-- Effect Categories -->
      <div v-for="category in effectCategories" :key="category.category" class="space-y-2">
        <button
          @click="toggleCategory('effect', category.category)"
          class="flex items-center justify-between w-full text-left"
        >
          <span class="text-xs font-medium text-white/70">{{ category.label }}</span>
          <ChevronDown
            :size="14"
            class="text-white/40 transition-transform"
            :class="{ 'rotate-180': expandedCategories.has(`effect-${category.category}`) }"
          />
        </button>
        
        <div
          v-if="expandedCategories.has(`effect-${category.category}`)"
          class="grid grid-cols-3 gap-2"
        >
          <button
            v-for="preset in category.presets"
            :key="preset.type"
            @click="selectEffect(preset)"
            @mouseenter="previewItem(preset, 'effect')"
            @mouseleave="clearPreview"
            class="p-2 rounded-lg border border-white/10 bg-white/5 hover:border-violet-500/50 hover:bg-violet-500/10 transition-all text-center group relative overflow-hidden"
            :class="{ 'border-violet-500 bg-violet-500/20': selectedEffect?.type === preset.type }"
          >
            <!-- Hover Video Preview -->
            <div 
              v-if="hoveredItem?.name === preset.name && hoveredType === 'effect'"
              class="w-full aspect-video bg-black rounded mb-1.5 overflow-hidden relative"
            >
              <video
                src="https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.webm"
                class="w-full h-full object-cover"
                autoplay
                muted
                loop
                playsinline
                :style="previewStyle(preset)"
              ></video>
            </div>

            <!-- Static Thumbnail -->
            <div 
              v-else
              class="w-full aspect-video bg-cover bg-center rounded mb-1.5 flex items-center justify-center overflow-hidden transition-all duration-300 group-hover:scale-105"
              :style="{ 
                backgroundImage: `url('https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.jpg')`,
                filter: getPresetCssFilter(preset)
              }"
            >
              <div class="absolute inset-0 bg-black/10 group-hover:bg-transparent transition-colors"></div>
              <Sparkles v-if="!preset.cssFilter" :size="16" class="text-white drop-shadow-md relative z-10 opacity-70" />
            </div>

            <span class="text-[10px] text-white/70 group-hover:text-white transition-colors line-clamp-1 relative z-10">
              {{ preset.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- Selected Effect Settings -->
      <div v-if="selectedEffect" class="p-3 bg-white/5 rounded-lg border border-violet-500/30 space-y-3">
        <div class="flex items-center justify-between">
          <span class="text-sm font-medium text-white">{{ selectedEffect.name }}</span>
          <button @click="selectedEffect = null" class="text-white/40 hover:text-white/70">
            <X :size="14" />
          </button>
        </div>
        
        <div>
          <div class="flex items-center justify-between mb-1">
            <label class="text-xs text-white/60">Intensity</label>
            <span class="text-xs text-white/40">{{ Math.round(effectIntensity * 100) }}%</span>
          </div>
          <input
            type="range"
            v-model.number="effectIntensity"
            min="0"
            max="1"
            step="0.05"
            class="w-full accent-violet-500"
          />
        </div>

        <button
          @click="applyEffect"
          class="w-full py-2 bg-violet-500 hover:bg-violet-600 text-white text-xs font-medium rounded-lg transition-colors"
        >
          Apply to Current Time Range
        </button>
      </div>

      <!-- Applied Effects List -->
      <div v-if="appliedEffects.length > 0" class="space-y-2">
        <h4 class="text-xs font-medium text-white/70">Applied Effects</h4>
        <div
          v-for="effect in appliedEffects"
          :key="effect.id"
          class="flex items-center justify-between p-2 bg-white/5 rounded-lg"
          :class="{ 'border border-violet-500/50': isEffectActive(effect) }"
        >
          <div class="flex items-center gap-2">
            <Sparkles :size="12" class="text-violet-400" />
            <span class="text-xs text-white">{{ effect.effectType }}</span>
            <span class="text-[10px] text-white/40">
              {{ effect.startTime.toFixed(1) }}s - {{ effect.endTime.toFixed(1) }}s
            </span>
          </div>
          <button
            @click="emit('deleteEffect', effect.id)"
            class="p-1 hover:bg-white/10 rounded transition-colors"
          >
            <Trash2 :size="12" class="text-red-400" />
          </button>
        </div>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed } from 'vue';
import { Shuffle, Sparkles, ChevronDown, X, Trash2 } from 'lucide-vue-next';
import type { ClipTransition, ClipEffect } from '@/types';
import { TRANSITION_CATEGORIES, type TransitionPresetData } from '@/data/transition-presets';
import { EFFECT_CATEGORIES, type EffectPresetData } from '@/data/effect-presets';

const props = defineProps<{
  appliedTransitions: ClipTransition[];
  appliedEffects: ClipEffect[];
  currentTime: number;
  duration: number;
  selectedSegmentIndex?: number;
}>();

const emit = defineEmits<{
  (e: 'addTransition', type: string, positionIndex: number, duration: number, parameters?: Record<string, unknown>): void;
  (e: 'updateTransition', id: string, updates: Partial<ClipTransition>): void;
  (e: 'deleteTransition', id: string): void;
  (e: 'addEffect', type: string, startTime: number, endTime: number, intensity: number, parameters?: Record<string, unknown>): void;
  (e: 'updateEffect', id: string, updates: Partial<ClipEffect>): void;
  (e: 'deleteEffect', id: string): void;
}>();

// Sub-tab state
const activeSubTab = ref<'transitions' | 'effects'>('transitions');

// Category expansion state
const expandedCategories = reactive(new Set<string>(['transition-basic', 'effect-basic']));

// Selection state
const selectedTransition = ref<TransitionPresetData | null>(null);
const selectedEffect = ref<EffectPresetData | null>(null);
const transitionDuration = ref(0.5);
const effectIntensity = ref(1);

// Preview state
const hoveredItem = ref<TransitionPresetData | EffectPresetData | null>(null);
const hoveredType = ref<'transition' | 'effect' | null>(null);

// Preset data
const transitionCategories = TRANSITION_CATEGORIES;
const effectCategories = EFFECT_CATEGORIES;

const previewStyle = computed(() => (item: TransitionPresetData | EffectPresetData) => {
  // For Transitions
  if ('cssAnimation' in item && item.cssAnimation) {
    return { 
      animation: `${item.cssAnimation} 2s infinite alternate ease-in-out` 
    };
  }

  // For Effects
  if ('cssFilter' in item && item.cssFilter) {
    let filter = item.cssFilter;
    if (item.defaultParameters) {
      Object.entries(item.defaultParameters).forEach(([key, value]) => {
        filter = filter.replace(`\${${key}}`, String(value));
      });
    }
    return { filter };
  }

  return {};
});

function toggleCategory(type: 'transition' | 'effect', category: string) {
  const key = `${type}-${category}`;
  if (expandedCategories.has(key)) {
    expandedCategories.delete(key);
  } else {
    expandedCategories.add(key);
  }
}

function selectTransition(preset: TransitionPresetData) {
  selectedTransition.value = preset;
  // Auto-preview on select
  hoveredItem.value = null; 
}

function selectEffect(preset: EffectPresetData) {
  selectedEffect.value = preset;
  hoveredItem.value = null;
}

function previewItem(preset: TransitionPresetData | EffectPresetData, type: 'transition' | 'effect') {
  hoveredItem.value = preset;
  hoveredType.value = type;
}

function clearPreview() {
  hoveredItem.value = null;
  hoveredType.value = null;
}

function getPresetCssFilter(preset: EffectPresetData): string {
  // This is kept for the static thumbnail, reusing the logic
  if (!preset.cssFilter) return 'none';
  let filter = preset.cssFilter;
  if (preset.defaultParameters) {
    Object.entries(preset.defaultParameters).forEach(([key, value]) => {
      filter = filter.replace(`\${${key}}`, String(value));
    });
  }
  return filter;
}

function applyTransition() {
  if (!selectedTransition.value) return;
  
  const positionIndex = props.selectedSegmentIndex ?? 0;
  emit(
    'addTransition',
    selectedTransition.value.type,
    positionIndex,
    transitionDuration.value,
    selectedTransition.value.defaultParameters
  );
  
  selectedTransition.value = null;
}

function applyEffect() {
  if (!selectedEffect.value) return;
  
  // Apply effect to current time range (default 2 seconds from current time)
  const startTime = props.currentTime;
  const endTime = Math.min(startTime + 2, props.duration);
  
  emit(
    'addEffect',
    selectedEffect.value.type,
    startTime,
    endTime,
    effectIntensity.value,
    selectedEffect.value.defaultParameters
  );
  
  selectedEffect.value = null;
}

function isEffectActive(effect: ClipEffect): boolean {
  return props.currentTime >= effect.startTime && props.currentTime < effect.endTime;
}
</script>

<style>
/* Unscoped so @keyframes are globally available for inline style bindings */

/* === BASIC TRANSITIONS === */
@keyframes fade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes opacity {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes crossfade {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}
@keyframes dissolve {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}
@keyframes dip-black {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(0); }
}
@keyframes dip-white {
  0%, 100% { filter: brightness(1); }
  50% { filter: brightness(2); }
}

/* === WIPE TRANSITIONS === */
@keyframes wipe-left {
  0%, 100% { clip-path: inset(0 0 0 0); }
  50% { clip-path: inset(0 100% 0 0); }
}
@keyframes wipe-right {
  0%, 100% { clip-path: inset(0 0 0 0); }
  50% { clip-path: inset(0 0 0 100%); }
}
@keyframes wipe-up {
  0%, 100% { clip-path: inset(0 0 0 0); }
  50% { clip-path: inset(100% 0 0 0); }
}
@keyframes wipe-down {
  0%, 100% { clip-path: inset(0 0 0 0); }
  50% { clip-path: inset(0 0 100% 0); }
}
@keyframes wipe-diagonal-tl {
  0%, 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
  50% { clip-path: polygon(0 0, 0 0, 0 0, 0 0); }
}
@keyframes wipe-diagonal-tr {
  0%, 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
  50% { clip-path: polygon(100% 0, 100% 0, 100% 0, 100% 0); }
}
@keyframes wipe-diagonal-bl {
  0%, 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
  50% { clip-path: polygon(0 100%, 0 100%, 0 100%, 0 100%); }
}
@keyframes wipe-diagonal-br {
  0%, 100% { clip-path: polygon(0 0, 100% 0, 100% 100%, 0 100%); }
  50% { clip-path: polygon(100% 100%, 100% 100%, 100% 100%, 100% 100%); }
}
@keyframes clock-wipe {
  0% { clip-path: polygon(50% 50%, 50% 0%, 50% 0%, 50% 0%, 50% 0%, 50% 0%); }
  25% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 50%, 100% 50%, 100% 50%); }
  50% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 50% 100%, 50% 100%); }
  75% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 50%); }
  100% { clip-path: polygon(50% 50%, 50% 0%, 100% 0%, 100% 100%, 0% 100%, 0% 0%); }
}
@keyframes radial-wipe {
  0%, 100% { clip-path: circle(0% at 50% 50%); }
  50% { clip-path: circle(75% at 50% 50%); }
}

/* === SLIDE/PUSH TRANSITIONS === */
@keyframes slide-left {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-50%); }
}
@keyframes slide-right {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(50%); }
}
@keyframes slide-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-50%); }
}
@keyframes slide-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(50%); }
}
@keyframes push-left {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(-50%); }
}
@keyframes push-right {
  0%, 100% { transform: translateX(0); }
  50% { transform: translateX(50%); }
}
@keyframes push-up {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-50%); }
}
@keyframes push-down {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(50%); }
}
@keyframes swipe-left {
  0%, 100% { transform: translateX(0); opacity: 1; }
  50% { transform: translateX(-30%); opacity: 0.5; }
}
@keyframes swipe-right {
  0%, 100% { transform: translateX(0); opacity: 1; }
  50% { transform: translateX(30%); opacity: 0.5; }
}
@keyframes swipe-up {
  0%, 100% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(-30%); opacity: 0.5; }
}
@keyframes swipe-down {
  0%, 100% { transform: translateY(0); opacity: 1; }
  50% { transform: translateY(30%); opacity: 0.5; }
}

/* === ZOOM TRANSITIONS === */
@keyframes zoom-in {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.5); }
}
@keyframes zoom-out {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(0.5); }
}
@keyframes zoom-blur {
  0%, 100% { transform: scale(1); filter: blur(0); }
  50% { transform: scale(1.3); filter: blur(5px); }
}
@keyframes zoom-rotate {
  0%, 100% { transform: scale(1) rotate(0deg); }
  50% { transform: scale(1.3) rotate(180deg); }
}
@keyframes cross-zoom {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.5); opacity: 0; }
}

/* === STYLIZED TRANSITIONS === */
@keyframes glitch {
  0% { transform: translate(0); filter: none; }
  20% { transform: translate(-3px, 2px); filter: hue-rotate(90deg); }
  40% { transform: translate(3px, -2px); filter: hue-rotate(180deg); }
  60% { transform: translate(-2px, -3px); filter: hue-rotate(270deg); }
  80% { transform: translate(2px, 3px); filter: hue-rotate(360deg); }
  100% { transform: translate(0); filter: none; }
}
@keyframes flash {
  0%, 100% { filter: brightness(1); }
  25%, 75% { filter: brightness(2.5); }
  50% { filter: brightness(1); }
}
@keyframes blur-transition {
  0%, 100% { filter: blur(0); }
  50% { filter: blur(10px); }
}
@keyframes pixelate {
  0%, 100% { filter: blur(0) contrast(1); }
  50% { filter: blur(3px) contrast(1.5); }
}
@keyframes rgb-split {
  0%, 100% { filter: none; transform: translateX(0); }
  25% { filter: drop-shadow(-3px 0 0 rgba(255,0,0,0.5)); transform: translateX(1px); }
  50% { filter: drop-shadow(3px 0 0 rgba(0,0,255,0.5)); transform: translateX(-1px); }
  75% { filter: drop-shadow(-3px 0 0 rgba(0,255,0,0.5)); transform: translateX(1px); }
}
@keyframes shake {
  0%, 100% { transform: translate(0); }
  10% { transform: translate(-5px, -3px); }
  20% { transform: translate(5px, 3px); }
  30% { transform: translate(-3px, 5px); }
  40% { transform: translate(3px, -5px); }
  50% { transform: translate(-5px, 3px); }
  60% { transform: translate(5px, -3px); }
  70% { transform: translate(-3px, -5px); }
  80% { transform: translate(3px, 5px); }
  90% { transform: translate(-5px, -3px); }
}
@keyframes spin {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}
@keyframes flip-h {
  0% { transform: perspective(400px) rotateY(0); }
  100% { transform: perspective(400px) rotateY(360deg); }
}
@keyframes flip-v {
  0% { transform: perspective(400px) rotateX(0); }
  100% { transform: perspective(400px) rotateX(360deg); }
}
@keyframes cube {
  0% { transform: perspective(400px) rotateY(0); }
  100% { transform: perspective(400px) rotateY(360deg); }
}
@keyframes page-curl {
  0%, 100% { transform: perspective(400px) rotateY(0); }
  50% { transform: perspective(400px) rotateY(-30deg); }
}

/* === SHAPE TRANSITIONS === */
@keyframes circle-open {
  0% { clip-path: circle(0% at 50% 50%); }
  100% { clip-path: circle(75% at 50% 50%); }
}
@keyframes circle-close {
  0% { clip-path: circle(75% at 50% 50%); }
  100% { clip-path: circle(0% at 50% 50%); }
}
@keyframes heart {
  0%, 100% { clip-path: circle(50% at 50% 50%); transform: scale(1); }
  50% { clip-path: circle(60% at 50% 50%); transform: scale(1.1); }
}
@keyframes star {
  0%, 100% { clip-path: circle(50% at 50% 50%); transform: rotate(0deg); }
  50% { clip-path: circle(60% at 50% 50%); transform: rotate(36deg); }
}
@keyframes diamond {
  0%, 100% { clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); }
  50% { clip-path: polygon(50% 10%, 90% 50%, 50% 90%, 10% 50%); }
}
@keyframes blinds-h {
  0%, 100% { clip-path: inset(0 0 0 0); }
  50% { clip-path: inset(10% 0 10% 0); }
}
@keyframes blinds-v {
  0%, 100% { clip-path: inset(0 0 0 0); }
  50% { clip-path: inset(0 10% 0 10%); }
}
@keyframes grid {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.5; transform: scale(0.95); }
}
@keyframes mosaic {
  0%, 100% { filter: blur(0); }
  50% { filter: blur(2px); }
}

/* === DIRECTIONAL TRANSITIONS === */
@keyframes luma-fade {
  0%, 100% { filter: brightness(1) contrast(1); }
  50% { filter: brightness(0.5) contrast(1.5); }
}
@keyframes rotate {
  0% { transform: rotate(0deg); }
  100% { transform: rotate(360deg); }
}

/* === FALLBACK === */
@keyframes pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(0.95); opacity: 0.8; }
}
</style>
