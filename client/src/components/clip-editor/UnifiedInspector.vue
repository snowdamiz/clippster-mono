<template>
  <div class="flex flex-col h-full bg-[#1a1a1a] border-l border-white/10">
    <!-- Header -->
    <div class="flex items-center justify-between px-3 py-2 border-b border-white/10">
      <div class="flex items-center gap-2">
        <Settings :size="14" class="text-violet-400" />
        <span class="text-sm font-medium text-white">Inspector</span>
      </div>
      <button
        v-if="selectedItem"
        @click="$emit('deselect')"
        class="p-1 rounded hover:bg-white/10 transition-colors"
        title="Deselect"
      >
        <X :size="14" class="text-white/50" />
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto">
      <!-- No Selection -->
      <div v-if="!selectedItem" class="flex flex-col items-center justify-center h-full text-center px-4">
        <MousePointer2 :size="32" class="text-white/20 mb-2" />
        <p class="text-xs text-white/40">No item selected</p>
        <p class="text-[10px] text-white/30 mt-1">Click an item on the timeline or preview to inspect it</p>
      </div>

      <!-- Item Properties -->
      <div v-else class="p-3 space-y-4">
        <!-- Item Type Badge -->
        <div class="flex items-center gap-2">
          <component :is="getItemIcon(selectedItem.type)" :size="16" :class="getItemIconClass(selectedItem.type)" />
          <span class="text-sm font-medium text-white capitalize">{{ formatItemType(selectedItem.type) }}</span>
          <span class="text-[10px] px-1.5 py-0.5 bg-white/10 rounded text-white/50 ml-auto">
            {{ selectedItem.id.slice(0, 8) }}
          </span>
        </div>

        <!-- Common Properties -->
        <div class="space-y-3">
          <h4 class="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Timing</h4>
          
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Start Time</label>
              <input
                type="number"
                :value="selectedItem.startTime?.toFixed(2)"
                @change="(e) => updateProperty('startTime', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Duration</label>
              <input
                type="number"
                :value="selectedItem.duration?.toFixed(2)"
                @change="(e) => updateProperty('duration', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0.1"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- Transform Properties -->
        <div v-if="hasTransformProperties" class="space-y-3">
          <h4 class="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Transform</h4>
          
          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Position X</label>
              <input
                type="number"
                :value="getTransformValue('positionX')"
                @change="(e) => updateTransform('positionX', parseFloat((e.target as HTMLInputElement).value))"
                step="1"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Position Y</label>
              <input
                type="number"
                :value="getTransformValue('positionY')"
                @change="(e) => updateTransform('positionY', parseFloat((e.target as HTMLInputElement).value))"
                step="1"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Scale</label>
              <input
                type="number"
                :value="getTransformValue('scale')"
                @change="(e) => updateTransform('scale', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0.1"
                max="5"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Rotation</label>
              <input
                type="number"
                :value="getTransformValue('rotation')"
                @change="(e) => updateTransform('rotation', parseFloat((e.target as HTMLInputElement).value))"
                step="1"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
          </div>

          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[10px] text-white/50">Opacity</label>
              <span class="text-[10px] text-white/40">{{ Math.round(getTransformValue('opacity') * 100) }}%</span>
            </div>
            <input
              type="range"
              :value="getTransformValue('opacity')"
              @input="(e) => updateTransform('opacity', parseFloat((e.target as HTMLInputElement).value))"
              step="0.01"
              min="0"
              max="1"
              class="w-full accent-violet-500"
            />
          </div>
        </div>

        <!-- Text-specific Properties -->
        <div v-if="selectedItem.type === 'text'" class="space-y-3">
          <h4 class="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Text</h4>
          
          <div>
            <label class="block text-[10px] text-white/50 mb-1">Content</label>
            <textarea
              :value="selectedItem.originalData?.text || ''"
              @change="(e) => updateOriginalData('text', (e.target as HTMLTextAreaElement).value)"
              rows="3"
              class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none resize-none"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Font Size</label>
              <input
                type="number"
                :value="selectedItem.originalData?.fontSize || 24"
                @change="(e) => updateOriginalData('fontSize', parseInt((e.target as HTMLInputElement).value))"
                step="1"
                min="8"
                max="200"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-violet-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Color</label>
              <input
                type="color"
                :value="selectedItem.originalData?.color || '#ffffff'"
                @change="(e) => updateOriginalData('color', (e.target as HTMLInputElement).value)"
                class="w-full h-8 rounded cursor-pointer"
              />
            </div>
          </div>
        </div>

        <!-- Audio-specific Properties -->
        <div v-if="selectedItem.type === 'audio'" class="space-y-3">
          <h4 class="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Audio</h4>
          
          <div>
            <div class="flex items-center justify-between mb-1">
              <label class="text-[10px] text-white/50">Volume</label>
              <span class="text-[10px] text-white/40">{{ Math.round((selectedItem.originalData?.volume || 1) * 100) }}%</span>
            </div>
            <input
              type="range"
              :value="selectedItem.originalData?.volume || 1"
              @input="(e) => updateOriginalData('volume', parseFloat((e.target as HTMLInputElement).value))"
              step="0.01"
              min="0"
              max="2"
              class="w-full accent-emerald-500"
            />
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Fade In</label>
              <input
                type="number"
                :value="selectedItem.originalData?.fadeIn || 0"
                @change="(e) => updateOriginalData('fadeIn', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
            <div>
              <label class="block text-[10px] text-white/50 mb-1">Fade Out</label>
              <input
                type="number"
                :value="selectedItem.originalData?.fadeOut || 0"
                @change="(e) => updateOriginalData('fadeOut', parseFloat((e.target as HTMLInputElement).value))"
                step="0.1"
                min="0"
                class="w-full px-2 py-1.5 bg-white/5 border border-white/10 rounded text-xs text-white focus:border-emerald-500/50 focus:outline-none"
              />
            </div>
          </div>
        </div>

        <!-- Effect-specific Properties -->
        <div v-if="selectedItem.type === 'effect' || selectedItem.type === 'adjustment_layer'" class="space-y-3">
          <h4 class="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Effect Settings</h4>
          
          <div v-if="selectedItem.originalData?.effect_type === 'blur'">
            <div class="flex items-center justify-between mb-1">
              <label class="text-[10px] text-white/50">Blur Amount</label>
              <span class="text-[10px] text-white/40">{{ selectedItem.originalData?.settings?.blurAmount || 0 }}px</span>
            </div>
            <input
              type="range"
              :value="selectedItem.originalData?.settings?.blurAmount || 0"
              @input="(e) => updateEffectSetting('blurAmount', parseFloat((e.target as HTMLInputElement).value))"
              step="1"
              min="0"
              max="50"
              class="w-full accent-blue-500"
            />
          </div>

          <div v-if="selectedItem.type === 'adjustment_layer'">
            <div class="space-y-2">
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] text-white/50">Brightness</label>
                  <span class="text-[10px] text-white/40">{{ selectedItem.originalData?.settings?.brightness || 0 }}</span>
                </div>
                <input
                  type="range"
                  :value="selectedItem.originalData?.settings?.brightness || 0"
                  @input="(e) => updateEffectSetting('brightness', parseInt((e.target as HTMLInputElement).value))"
                  min="-100"
                  max="100"
                  class="w-full accent-purple-500"
                />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] text-white/50">Contrast</label>
                  <span class="text-[10px] text-white/40">{{ selectedItem.originalData?.settings?.contrast || 0 }}</span>
                </div>
                <input
                  type="range"
                  :value="selectedItem.originalData?.settings?.contrast || 0"
                  @input="(e) => updateEffectSetting('contrast', parseInt((e.target as HTMLInputElement).value))"
                  min="-100"
                  max="100"
                  class="w-full accent-purple-500"
                />
              </div>
              <div>
                <div class="flex items-center justify-between mb-1">
                  <label class="text-[10px] text-white/50">Saturation</label>
                  <span class="text-[10px] text-white/40">{{ selectedItem.originalData?.settings?.saturation || 0 }}</span>
                </div>
                <input
                  type="range"
                  :value="selectedItem.originalData?.settings?.saturation || 0"
                  @input="(e) => updateEffectSetting('saturation', parseInt((e.target as HTMLInputElement).value))"
                  min="-100"
                  max="100"
                  class="w-full accent-purple-500"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- Keyframes Section -->
        <div v-if="selectedItem.keyframes && selectedItem.keyframes.length > 0" class="space-y-3">
          <div class="flex items-center justify-between">
            <h4 class="text-[10px] uppercase tracking-wider text-white/40 font-semibold">Keyframes</h4>
            <span class="text-[10px] text-white/30">{{ selectedItem.keyframes.length }}</span>
          </div>
          
          <div class="space-y-1 max-h-32 overflow-y-auto">
            <div
              v-for="kf in selectedItem.keyframes"
              :key="kf.id"
              class="flex items-center gap-2 px-2 py-1.5 bg-white/5 rounded text-xs"
            >
              <Diamond :size="10" class="text-yellow-400" />
              <span class="text-white/70">{{ kf.property }}</span>
              <span class="text-white/40 ml-auto">{{ kf.time.toFixed(2) }}s</span>
              <span class="text-white/60">{{ typeof kf.value === 'number' ? kf.value.toFixed(2) : kf.value }}</span>
            </div>
          </div>
        </div>

        <!-- Actions -->
        <div class="pt-3 border-t border-white/10 space-y-2">
          <button
            @click="$emit('duplicate', selectedItem)"
            class="w-full px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded text-xs text-white/70 hover:text-white transition-colors flex items-center justify-center gap-2"
          >
            <Copy :size="12" />
            Duplicate
          </button>
          <button
            @click="$emit('delete', selectedItem.id)"
            class="w-full px-3 py-2 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded text-xs text-red-400 hover:text-red-300 transition-colors flex items-center justify-center gap-2"
          >
            <Trash2 :size="12" />
            Delete
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import {
  Settings,
  X,
  MousePointer2,
  Film,
  Music,
  Type,
  Image,
  Smile,
  Palette,
  Layers,
  Diamond,
  Copy,
  Trash2,
} from 'lucide-vue-next';
import type { TimelineItem, TimelineItemType } from '@/types/timeline-model';

const props = defineProps<{
  selectedItem: TimelineItem | null;
}>();

const emit = defineEmits<{
  (e: 'deselect'): void;
  (e: 'update', id: string, updates: Partial<TimelineItem>): void;
  (e: 'updateOriginalData', id: string, key: string, value: any): void;
  (e: 'updateEffectSetting', id: string, key: string, value: any): void;
  (e: 'duplicate', item: TimelineItem): void;
  (e: 'delete', id: string): void;
}>();

const hasTransformProperties = computed(() => {
  if (!props.selectedItem) return false;
  const type = props.selectedItem.type;
  return ['text', 'sticker', 'watermark', 'video'].includes(type);
});

function getItemIcon(type: TimelineItemType) {
  switch (type) {
    case 'video': return Film;
    case 'audio': return Music;
    case 'text': return Type;
    case 'sticker': return Smile;
    case 'watermark': return Image;
    case 'effect': return Palette;
    case 'adjustment_layer': return Layers;
    default: return Settings;
  }
}

function getItemIconClass(type: TimelineItemType): string {
  switch (type) {
    case 'video': return 'text-blue-400';
    case 'audio': return 'text-emerald-400';
    case 'text': return 'text-yellow-400';
    case 'sticker': return 'text-pink-400';
    case 'watermark': return 'text-cyan-400';
    case 'effect': return 'text-purple-400';
    case 'adjustment_layer': return 'text-violet-400';
    default: return 'text-white/60';
  }
}

function formatItemType(type: TimelineItemType): string {
  if (type === 'adjustment_layer') return 'Adjustment Layer';
  return type;
}

function getTransformValue(prop: string): number {
  if (!props.selectedItem) return 0;
  
  const item = props.selectedItem;
  switch (prop) {
    case 'positionX': return item.positionX ?? 50;
    case 'positionY': return item.positionY ?? 50;
    case 'scale': return item.scale ?? 1;
    case 'rotation': return item.rotation ?? 0;
    case 'opacity': return item.opacity ?? 1;
    default: return 0;
  }
}

function updateProperty(key: string, value: any) {
  if (!props.selectedItem) return;
  emit('update', props.selectedItem.id, { [key]: value });
}

function updateTransform(prop: string, value: number) {
  if (!props.selectedItem) return;
  emit('update', props.selectedItem.id, { [prop]: value });
}

function updateOriginalData(key: string, value: any) {
  if (!props.selectedItem) return;
  emit('updateOriginalData', props.selectedItem.id, key, value);
}

function updateEffectSetting(key: string, value: any) {
  if (!props.selectedItem) return;
  emit('updateEffectSetting', props.selectedItem.id, key, value);
}
</script>
