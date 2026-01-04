<template>
  <div class="space-y-6">
    <div>
      <h3 class="text-sm font-medium text-white mb-1">Visual Effects</h3>
      <p class="text-xs text-white/50 mb-4">
        Add adjustment layers, chroma key, and other visual effects to your timeline.
      </p>
    </div>

    <!-- Add Effect Section -->
    <div class="space-y-3">
      <h4 class="text-sm font-medium text-white">Add Effect</h4>
      
      <div class="grid grid-cols-2 gap-2">
        <!-- Adjustment Layer -->
        <button
          @click="addAdjustmentLayer"
          class="p-3 rounded-lg border border-white/10 bg-white/5 hover:border-purple-500/50 hover:bg-purple-500/10 transition-all text-left"
        >
          <div class="flex items-center gap-2 mb-1">
            <Layers :size="16" class="text-purple-400" />
            <span class="text-sm text-white font-medium">Adjustment Layer</span>
          </div>
          <p class="text-[10px] text-white/50">Apply filters to all layers below</p>
        </button>

        <!-- Chroma Key -->
        <button
          @click="addChromaKey"
          class="p-3 rounded-lg border border-white/10 bg-white/5 hover:border-green-500/50 hover:bg-green-500/10 transition-all text-left"
        >
          <div class="flex items-center gap-2 mb-1">
            <Pipette :size="16" class="text-green-400" />
            <span class="text-sm text-white font-medium">Chroma Key</span>
          </div>
          <p class="text-[10px] text-white/50">Remove green screen background</p>
        </button>

        <!-- Blur Effect -->
        <button
          @click="addBlurEffect"
          class="p-3 rounded-lg border border-white/10 bg-white/5 hover:border-blue-500/50 hover:bg-blue-500/10 transition-all text-left"
        >
          <div class="flex items-center gap-2 mb-1">
            <CircleDot :size="16" class="text-blue-400" />
            <span class="text-sm text-white font-medium">Blur</span>
          </div>
          <p class="text-[10px] text-white/50">Add gaussian or motion blur</p>
        </button>

        <!-- Flash Effect -->
        <button
          @click="addFlashEffect"
          class="p-3 rounded-lg border border-white/10 bg-white/5 hover:border-yellow-500/50 hover:bg-yellow-500/10 transition-all text-left"
        >
          <div class="flex items-center gap-2 mb-1">
            <Zap :size="16" class="text-yellow-400" />
            <span class="text-sm text-white font-medium">Flash</span>
          </div>
          <p class="text-[10px] text-white/50">White flash or strobe effect</p>
        </button>
      </div>
    </div>

    <!-- Active Effects List -->
    <div v-if="effects.length > 0" class="border-t border-white/10 pt-4">
      <h4 class="text-sm font-medium text-white mb-3">Active Effects ({{ effects.length }})</h4>

      <div class="space-y-3">
        <div
          v-for="effect in effects"
          :key="effect.id"
          class="p-4 bg-white/5 rounded-lg border border-white/10"
          :class="getEffectBorderClass(effect)"
        >
          <div class="flex items-start justify-between mb-3">
            <div class="flex items-center gap-2">
              <component :is="getEffectIcon(effect.type)" :size="16" :class="getEffectIconClass(effect.type)" />
              <span class="text-sm text-white font-medium">{{ getEffectName(effect.type) }}</span>
              <span
                v-if="isEffectActive(effect)"
                class="text-[10px] px-1.5 py-0.5 bg-violet-500/30 text-violet-300 rounded"
              >
                Active
              </span>
            </div>
            <button @click="emit('deleteEffect', effect.id)" class="p-1.5 rounded hover:bg-white/10 transition-colors">
              <Trash2 :size="14" class="text-red-400" />
            </button>
          </div>

          <!-- Timing Controls -->
          <div class="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label class="block text-xs text-white/60 mb-1">Start</label>
              <input
                type="number"
                :value="effect.startTime.toFixed(1)"
                @input="(e) => updateTiming(effect.id, 'startTime', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0"
                :max="effect.endTime - 0.1"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
            </div>
            <div>
              <label class="block text-xs text-white/60 mb-1">End</label>
              <input
                type="number"
                :value="effect.endTime.toFixed(1)"
                @input="(e) => updateTiming(effect.id, 'endTime', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                :min="effect.startTime + 0.1"
                :max="duration"
                class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
              />
            </div>
          </div>

          <!-- Effect-specific settings -->
          <details class="mt-2">
            <summary class="text-xs text-white/60 cursor-pointer hover:text-white/80">Settings</summary>
            <div class="mt-3 space-y-3">
              <!-- Adjustment Layer Settings -->
              <template v-if="effect.type === 'adjustment_layer'">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Brightness</label>
                    <span class="text-xs text-white/40">{{ effect.settings.brightness || 0 }}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    :value="effect.settings.brightness || 0"
                    @input="(e) => updateSetting(effect.id, 'brightness', parseInt((e.target as HTMLInputElement).value))"
                    class="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Contrast</label>
                    <span class="text-xs text-white/40">{{ effect.settings.contrast || 0 }}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    :value="effect.settings.contrast || 0"
                    @input="(e) => updateSetting(effect.id, 'contrast', parseInt((e.target as HTMLInputElement).value))"
                    class="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Saturation</label>
                    <span class="text-xs text-white/40">{{ effect.settings.saturation || 0 }}</span>
                  </div>
                  <input
                    type="range"
                    min="-100"
                    max="100"
                    :value="effect.settings.saturation || 0"
                    @input="(e) => updateSetting(effect.id, 'saturation', parseInt((e.target as HTMLInputElement).value))"
                    class="w-full accent-purple-500"
                  />
                </div>
                <div>
                  <label class="block text-xs text-white/60 mb-1">Blend Mode</label>
                  <select
                    :value="effect.settings.blendMode || 'normal'"
                    @change="(e) => updateSetting(effect.id, 'blendMode', (e.target as HTMLSelectElement).value)"
                    class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                  >
                    <option value="normal">Normal</option>
                    <option value="screen">Screen</option>
                    <option value="multiply">Multiply</option>
                    <option value="overlay">Overlay</option>
                    <option value="soft-light">Soft Light</option>
                    <option value="hard-light">Hard Light</option>
                    <option value="difference">Difference</option>
                  </select>
                </div>
              </template>

              <!-- Chroma Key Settings -->
              <template v-else-if="effect.type === 'chroma'">
                <div>
                  <label class="block text-xs text-white/60 mb-1">Key Color</label>
                  <div class="flex items-center gap-2">
                    <input
                      type="color"
                      :value="effect.settings.keyColor || '#00ff00'"
                      @input="(e) => updateSetting(effect.id, 'keyColor', (e.target as HTMLInputElement).value)"
                      class="w-8 h-8 rounded cursor-pointer"
                    />
                    <input
                      type="text"
                      :value="effect.settings.keyColor || '#00ff00'"
                      @input="(e) => updateSetting(effect.id, 'keyColor', (e.target as HTMLInputElement).value)"
                      class="flex-1 px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white font-mono"
                    />
                  </div>
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Tolerance</label>
                    <span class="text-xs text-white/40">{{ ((effect.settings.tolerance || 0.4) * 100).toFixed(0) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="(effect.settings.tolerance || 0.4) * 100"
                    @input="(e) => updateSetting(effect.id, 'tolerance', parseInt((e.target as HTMLInputElement).value) / 100)"
                    class="w-full accent-green-500"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Edge Softness</label>
                    <span class="text-xs text-white/40">{{ ((effect.settings.softness || 0.1) * 100).toFixed(0) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="(effect.settings.softness || 0.1) * 100"
                    @input="(e) => updateSetting(effect.id, 'softness', parseInt((e.target as HTMLInputElement).value) / 100)"
                    class="w-full accent-green-500"
                  />
                </div>
              </template>

              <!-- Blur Settings -->
              <template v-else-if="effect.type === 'blur'">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Blur Amount</label>
                    <span class="text-xs text-white/40">{{ effect.settings.blurAmount || 0 }}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="50"
                    :value="effect.settings.blurAmount || 0"
                    @input="(e) => updateSetting(effect.id, 'blurAmount', parseInt((e.target as HTMLInputElement).value))"
                    class="w-full accent-blue-500"
                  />
                </div>
                <div>
                  <label class="block text-xs text-white/60 mb-1">Blur Type</label>
                  <select
                    :value="effect.settings.blurType || 'gaussian'"
                    @change="(e) => updateSetting(effect.id, 'blurType', (e.target as HTMLSelectElement).value)"
                    class="w-full px-2 py-1 bg-white/5 border border-white/10 rounded text-xs text-white"
                  >
                    <option value="gaussian">Gaussian</option>
                    <option value="motion">Motion</option>
                    <option value="radial">Radial</option>
                  </select>
                </div>
              </template>

              <!-- Flash Settings -->
              <template v-else-if="effect.type === 'flash'">
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Intensity</label>
                    <span class="text-xs text-white/40">{{ ((effect.settings.intensity || 1) * 100).toFixed(0) }}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    :value="(effect.settings.intensity || 1) * 100"
                    @input="(e) => updateSetting(effect.id, 'intensity', parseInt((e.target as HTMLInputElement).value) / 100)"
                    class="w-full accent-yellow-500"
                  />
                </div>
                <div>
                  <div class="flex items-center justify-between mb-1">
                    <label class="text-xs text-white/60">Frequency (Hz)</label>
                    <span class="text-xs text-white/40">{{ effect.settings.frequency || 0 }}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="0.5"
                    :value="effect.settings.frequency || 0"
                    @input="(e) => updateSetting(effect.id, 'frequency', parseFloat((e.target as HTMLInputElement).value))"
                    class="w-full accent-yellow-500"
                  />
                  <p class="text-[10px] text-white/40 mt-1">0 = single flash, higher = strobe</p>
                </div>
              </template>
            </div>
          </details>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="py-8 text-center">
      <Layers :size="32" class="mx-auto text-white/20 mb-3" />
      <p class="text-sm text-white/40">No effects added yet</p>
      <p class="text-xs text-white/30 mt-1">Add adjustment layers or visual effects above</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Layers, Pipette, CircleDot, Zap, Trash2 } from 'lucide-vue-next';
import type { Effect, EffectType, EffectSettings } from '@/types';

const props = defineProps<{
  effects: Effect[];
  currentTime: number;
  duration: number;
}>();

const emit = defineEmits<{
  (e: 'addEffect', type: EffectType, settings: EffectSettings): void;
  (e: 'updateEffect', id: string, updates: Partial<Effect>): void;
  (e: 'deleteEffect', id: string): void;
}>();

function addAdjustmentLayer() {
  emit('addEffect', 'adjustment_layer', {
    brightness: 0,
    contrast: 0,
    saturation: 0,
    blendMode: 'normal',
  });
}

function addChromaKey() {
  emit('addEffect', 'chroma', {
    keyColor: '#00ff00',
    tolerance: 0.4,
    softness: 0.1,
  });
}

function addBlurEffect() {
  emit('addEffect', 'blur', {
    blurAmount: 10,
    blurType: 'gaussian',
  });
}

function addFlashEffect() {
  emit('addEffect', 'flash', {
    intensity: 1,
    frequency: 0,
  });
}

function updateTiming(id: string, field: 'startTime' | 'endTime', value: number) {
  if (isNaN(value)) return;
  emit('updateEffect', id, { [field]: value });
}

function updateSetting(id: string, key: string, value: any) {
  const effect = props.effects.find(e => e.id === id);
  if (!effect) return;
  
  emit('updateEffect', id, {
    settings: {
      ...effect.settings,
      [key]: value,
    },
  });
}

function isEffectActive(effect: Effect): boolean {
  return props.currentTime >= effect.startTime && props.currentTime < effect.endTime;
}

function getEffectName(type: EffectType): string {
  switch (type) {
    case 'adjustment_layer': return 'Adjustment Layer';
    case 'chroma': return 'Chroma Key';
    case 'blur': return 'Blur';
    case 'flash': return 'Flash';
    case 'filter': return 'Filter';
    default: return type;
  }
}

function getEffectIcon(type: EffectType) {
  switch (type) {
    case 'adjustment_layer': return Layers;
    case 'chroma': return Pipette;
    case 'blur': return CircleDot;
    case 'flash': return Zap;
    default: return Layers;
  }
}

function getEffectIconClass(type: EffectType): string {
  switch (type) {
    case 'adjustment_layer': return 'text-purple-400';
    case 'chroma': return 'text-green-400';
    case 'blur': return 'text-blue-400';
    case 'flash': return 'text-yellow-400';
    default: return 'text-white/60';
  }
}

function getEffectBorderClass(effect: Effect): string {
  if (!isEffectActive(effect)) return '';
  
  switch (effect.type) {
    case 'adjustment_layer': return 'border-purple-500/50 bg-purple-500/10';
    case 'chroma': return 'border-green-500/50 bg-green-500/10';
    case 'blur': return 'border-blue-500/50 bg-blue-500/10';
    case 'flash': return 'border-yellow-500/50 bg-yellow-500/10';
    default: return 'border-violet-500/50 bg-violet-500/10';
  }
}
</script>
