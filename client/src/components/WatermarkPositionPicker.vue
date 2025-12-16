<template>
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/80 backdrop-blur-md" @click="$emit('close')"></div>
      <Transition name="dialog" appear>
        <div
          class="relative flex flex-col w-full max-w-4xl mx-3 overflow-hidden bg-gradient-to-b from-zinc-900 to-zinc-950 border border-white/10 rounded-xl max-h-[95vh]"
        >
          <!-- Header -->
          <div class="flex items-center justify-between px-5 py-4 border-b border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <div class="flex items-center gap-3">
              <div
                class="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center border border-amber-500/30"
              >
                <Move class="h-5 w-5 text-amber-400" />
              </div>
              <div>
                <h2 class="text-lg font-semibold text-white">Position Watermark</h2>
                <p class="text-xs text-muted-foreground">Set position for each aspect ratio</p>
              </div>
            </div>
            <button
              @click="$emit('close')"
              class="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors border border-zinc-800"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-6">
            <!-- Aspect Ratio Tabs with Enable Toggle -->
            <div class="flex items-center gap-2 mb-4 flex-wrap">
              <span class="text-xs text-muted-foreground mr-2">Aspect Ratio:</span>
              <button
                v-for="ar in aspectRatios"
                :key="ar.id"
                @click="selectAspectRatio(ar.id)"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all flex items-center gap-1.5 relative"
                :class="[
                  currentAspectRatio === ar.id
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : enabledRatios[ar.id]
                      ? 'bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 border border-zinc-700'
                      : 'bg-zinc-900 text-zinc-500 hover:text-zinc-400 hover:bg-zinc-800 border border-zinc-800'
                ]"
              >
                <component :is="ar.icon" class="w-3.5 h-3.5" />
                {{ ar.label }}
                <span 
                  v-if="enabledRatios[ar.id]" 
                  class="w-1.5 h-1.5 rounded-full bg-green-500 absolute -top-0.5 -right-0.5"
                ></span>
              </button>
            </div>

            <!-- Enable/Disable Toggle for Current Ratio -->
            <div class="flex items-center justify-between mb-4 p-3 bg-zinc-800/50 rounded-lg border border-zinc-700">
              <div class="flex items-center gap-2">
                <span class="text-sm text-zinc-300">Enable watermark for {{ currentAspectRatioLabel }}</span>
                <span v-if="!enabledRatios[currentAspectRatio]" class="text-xs text-zinc-500">(Watermark won't be applied)</span>
              </div>
              <button
                @click="toggleCurrentRatio"
                class="relative w-11 h-6 rounded-full transition-colors"
                :class="enabledRatios[currentAspectRatio] ? 'bg-amber-500' : 'bg-zinc-600'"
              >
                <span
                  class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform"
                  :class="enabledRatios[currentAspectRatio] ? 'translate-x-5' : 'translate-x-0'"
                ></span>
              </button>
            </div>

            <!-- Watermark Selection for Current Ratio -->
            <div v-if="enabledRatios[currentAspectRatio]" class="mb-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
              <div class="flex items-center justify-between mb-2">
                <label class="text-xs font-medium text-zinc-400">Watermark for {{ currentAspectRatioLabel }}</label>
                <span 
                  v-if="currentAspectRatio !== '16:9' && !ratioWatermarkIds[currentAspectRatio]"
                  class="text-[9px] px-1.5 py-0.5 bg-zinc-700 text-zinc-400 rounded"
                >
                  Using default
                </span>
              </div>
              <div class="relative">
                <button
                  type="button"
                  @click.stop="showWatermarkDropdown = !showWatermarkDropdown"
                  class="w-full px-3 py-2.5 bg-zinc-800 border border-zinc-700 rounded-lg text-left flex items-center justify-between hover:border-zinc-600 hover:bg-zinc-700/80 transition-all text-sm text-white"
                >
                  <div class="flex items-center gap-3">
                    <!-- Watermark thumbnail preview -->
                    <div
                      v-if="currentRatioWatermarkUrl"
                      class="w-8 h-8 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center overflow-hidden"
                    >
                      <img
                        :src="currentRatioWatermarkUrl"
                        :alt="currentRatioWatermark?.name || 'Default'"
                        class="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div
                      v-else
                      class="w-8 h-8 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center"
                    >
                      <ImageIcon class="w-4 h-4 text-zinc-500" />
                    </div>
                    <span class="truncate">
                      {{ currentRatioWatermark?.name || (ratioWatermarkIds[currentAspectRatio] ? 'Unknown' : 'Use default watermark') }}
                    </span>
                  </div>
                  <ChevronDown
                    class="h-4 w-4 text-zinc-400 transition-transform flex-shrink-0 ml-2"
                    :class="{ 'rotate-180': showWatermarkDropdown }"
                  />
                </button>

                <!-- Watermark Dropdown -->
                <div
                  v-if="showWatermarkDropdown"
                  class="absolute top-full left-0 right-0 mt-1 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl z-50 overflow-y-auto max-h-48 custom-scrollbar"
                  @click.stop
                >
                  <!-- Use default option -->
                  <button
                    @click="selectWatermarkForRatio(null)"
                    class="w-full text-left px-3 py-2.5 hover:bg-zinc-700 transition-colors text-sm flex items-center gap-3 border-b border-zinc-700/50"
                    :class="{ 'bg-amber-500/10 text-amber-400': !ratioWatermarkIds[currentAspectRatio] }"
                  >
                    <div class="w-8 h-8 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center">
                      <ImageIcon class="w-4 h-4 text-zinc-500" />
                    </div>
                    <span>Use default watermark</span>
                  </button>
                  
                  <!-- Watermark options -->
                  <button
                    v-for="wm in watermarks"
                    :key="wm.id"
                    @click="selectWatermarkForRatio(wm)"
                    class="w-full text-left px-3 py-2.5 hover:bg-zinc-700 transition-colors text-sm flex items-center gap-3"
                    :class="{ 'bg-amber-500/10 text-amber-400': ratioWatermarkIds[currentAspectRatio] === wm.id }"
                  >
                    <div class="w-8 h-8 rounded bg-zinc-700 border border-zinc-600 flex items-center justify-center overflow-hidden">
                      <img
                        v-if="watermarkThumbnailCache.get(wm.id)"
                        :src="watermarkThumbnailCache.get(wm.id)"
                        :alt="wm.name"
                        class="max-w-full max-h-full object-contain"
                      />
                      <ImageIcon v-else class="w-4 h-4 text-zinc-500" />
                    </div>
                    <div class="flex-1 min-w-0">
                      <span class="truncate block">{{ wm.name }}</span>
                      <span v-if="wm.width && wm.height" class="text-[10px] text-zinc-500">
                        {{ wm.width }}×{{ wm.height }}
                      </span>
                    </div>
                  </button>
                  
                  <div v-if="loadingWatermarks" class="px-3 py-4 text-sm text-center text-zinc-500">
                    Loading...
                  </div>
                  <div v-if="!loadingWatermarks && watermarks.length === 0" class="px-3 py-4 text-center">
                    <p class="text-sm text-zinc-500">No watermarks available</p>
                  </div>
                  
                  <!-- Upload new watermark button -->
                  <button
                    @click="uploadNewWatermark"
                    :disabled="uploadingWatermark"
                    class="w-full text-left px-3 py-2.5 hover:bg-zinc-700 transition-colors text-sm flex items-center gap-3 border-t border-zinc-700/50 text-amber-400 hover:text-amber-300"
                  >
                    <div class="w-8 h-8 rounded bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                      <Upload v-if="!uploadingWatermark" class="w-4 h-4 text-amber-400" />
                      <Loader2 v-else class="w-4 h-4 text-amber-400 animate-spin" />
                    </div>
                    <span>{{ uploadingWatermark ? 'Uploading...' : 'Upload new watermark' }}</span>
                  </button>
                </div>
              </div>
              
              <p v-if="currentAspectRatio !== '16:9'" class="text-[10px] text-zinc-500 mt-2">
                💡 You can use a different watermark image for {{ currentAspectRatioLabel }} format
              </p>
            </div>

            <!-- Preview Area with dynamic aspect ratio -->
            <div class="flex justify-center">
              <div
                ref="previewContainer"
                class="relative bg-zinc-800 rounded-xl overflow-hidden border-2 shadow-inner transition-all duration-300"
                :class="[
                  enabledRatios[currentAspectRatio] 
                    ? 'cursor-crosshair border-zinc-700' 
                    : 'cursor-not-allowed border-zinc-800 opacity-50'
                ]"
                :style="previewContainerStyle"
                @click="enabledRatios[currentAspectRatio] && handleClick($event)"
                @mousedown="enabledRatios[currentAspectRatio] && startDrag($event)"
                @mousemove="enabledRatios[currentAspectRatio] && handleDrag($event)"
                @mouseup="endDrag"
                @mouseleave="endDrag"
              >
                <!-- Grid lines for guidance -->
                <div class="absolute inset-0 pointer-events-none">
                  <!-- Vertical thirds -->
                  <div class="absolute left-1/3 top-0 bottom-0 w-px bg-white/10"></div>
                  <div class="absolute left-2/3 top-0 bottom-0 w-px bg-white/10"></div>
                  <!-- Horizontal thirds -->
                  <div class="absolute top-1/3 left-0 right-0 h-px bg-white/10"></div>
                  <div class="absolute top-2/3 left-0 right-0 h-px bg-white/10"></div>
                  <!-- Center crosshair -->
                  <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8">
                    <div class="absolute left-1/2 top-0 bottom-0 w-px bg-white/20 -translate-x-1/2"></div>
                    <div class="absolute top-1/2 left-0 right-0 h-px bg-white/20 -translate-y-1/2"></div>
                  </div>
                </div>

                <!-- Aspect ratio label -->
                <div class="absolute top-2 left-2 px-2 py-1 bg-black/50 rounded text-xs text-white/70">
                  {{ currentAspectRatioLabel }}
                </div>

                <!-- Sample video content indicator -->
                <div class="absolute inset-0 flex items-center justify-center text-zinc-600">
                  <div class="text-center">
                    <Video class="w-12 h-12 mx-auto mb-1 opacity-30" />
                    <span class="text-xs opacity-50">Preview</span>
                  </div>
                </div>

                <!-- Loading indicator -->
                <div v-if="loadingWatermark" class="absolute inset-0 flex items-center justify-center bg-black/30">
                  <div class="text-amber-400 text-sm">Loading watermark...</div>
                </div>

                <!-- Watermark preview -->
                <div
                  v-if="watermarkDataUrl && enabledRatios[currentAspectRatio]"
                  class="absolute pointer-events-none transition-all duration-75"
                  :style="watermarkStyle"
                >
                  <img
                    :src="watermarkDataUrl"
                    class="max-w-full max-h-full object-contain drop-shadow-lg"
                    :style="{ opacity: currentSettings.opacity / 100 }"
                    @error="handleImageError"
                  />
                </div>

                <!-- Disabled overlay -->
                <div
                  v-if="!enabledRatios[currentAspectRatio]"
                  class="absolute inset-0 flex items-center justify-center bg-black/40"
                >
                  <div class="text-center px-4">
                    <span class="text-zinc-400 text-sm">Watermark disabled for {{ currentAspectRatioLabel }}</span>
                    <p class="text-zinc-500 text-xs mt-1">Click the toggle above to enable</p>
                  </div>
                </div>

                <!-- Position indicator -->
                <div
                  v-if="enabledRatios[currentAspectRatio]"
                  class="absolute w-3 h-3 bg-amber-500 rounded-full border-2 border-white shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                  :style="{ left: `${currentSettings.x}%`, top: `${currentSettings.y}%` }"
                ></div>
              </div>
            </div>

            <!-- Quick position buttons -->
            <div class="mt-4 flex items-center justify-center gap-2 flex-wrap" :class="{ 'opacity-50 pointer-events-none': !enabledRatios[currentAspectRatio] }">
              <span class="text-xs text-muted-foreground mr-2">Quick positions:</span>
              <button
                v-for="preset in presets"
                :key="preset.name"
                @click="applyPreset(preset)"
                :disabled="!enabledRatios[currentAspectRatio]"
                class="px-3 py-1.5 text-xs font-medium rounded-lg transition-all"
                :class="
                  isPresetActive(preset)
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-700 border border-zinc-700'
                "
              >
                {{ preset.name }}
              </button>
            </div>

            <!-- Sliders -->
            <div class="mt-6 grid grid-cols-2 gap-x-6 gap-y-4" :class="{ 'opacity-50 pointer-events-none': !enabledRatios[currentAspectRatio] }">
              <!-- Horizontal Position slider -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-zinc-300">Horizontal (X)</label>
                  <span class="text-xs text-muted-foreground">{{ currentSettings.x }}%</span>
                </div>
                <input
                  type="range"
                  :value="currentSettings.x"
                  @input="updateX(Number(($event.target as HTMLInputElement).value))"
                  min="0"
                  max="100"
                  :disabled="!enabledRatios[currentAspectRatio]"
                  class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <!-- Vertical Position slider -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-zinc-300">Vertical (Y)</label>
                  <span class="text-xs text-muted-foreground">{{ currentSettings.y }}%</span>
                </div>
                <input
                  type="range"
                  :value="currentSettings.y"
                  @input="updateY(Number(($event.target as HTMLInputElement).value))"
                  min="0"
                  max="100"
                  :disabled="!enabledRatios[currentAspectRatio]"
                  class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <!-- Scale slider -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-zinc-300">Size</label>
                  <span class="text-xs text-muted-foreground">{{ currentSettings.scale }}%</span>
                </div>
                <input
                  type="range"
                  :value="currentSettings.scale"
                  @input="updateScale(Number(($event.target as HTMLInputElement).value))"
                  min="5"
                  max="50"
                  :disabled="!enabledRatios[currentAspectRatio]"
                  class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>

              <!-- Opacity slider -->
              <div>
                <div class="flex items-center justify-between mb-2">
                  <label class="text-sm font-medium text-zinc-300">Opacity</label>
                  <span class="text-xs text-muted-foreground">{{ currentSettings.opacity }}%</span>
                </div>
                <input
                  type="range"
                  :value="currentSettings.opacity"
                  @input="updateOpacity(Number(($event.target as HTMLInputElement).value))"
                  min="10"
                  max="100"
                  :disabled="!enabledRatios[currentAspectRatio]"
                  class="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />
              </div>
            </div>

            <!-- Copy settings to other ratios -->
            <div class="mt-4 pt-4 border-t border-zinc-800">
              <div class="flex items-center justify-between flex-wrap gap-2">
                <span class="text-xs text-muted-foreground">Apply current settings to all enabled ratios:</span>
                <button
                  @click="copyToAllRatios"
                  :disabled="!enabledRatios[currentAspectRatio]"
                  class="px-3 py-1.5 text-xs font-medium bg-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-700 rounded-lg transition-all border border-zinc-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Apply to All Enabled
                </button>
              </div>
            </div>

            <!-- Summary of enabled ratios -->
            <div class="mt-4 p-3 bg-zinc-800/30 rounded-lg border border-zinc-800">
              <div class="text-xs text-muted-foreground mb-2">Watermark will be applied to:</div>
              <div class="flex flex-wrap gap-2">
                <span 
                  v-for="ar in aspectRatios" 
                  :key="ar.id"
                  class="px-2 py-1 text-xs rounded"
                  :class="enabledRatios[ar.id] ? 'bg-green-500/20 text-green-400' : 'bg-zinc-700/50 text-zinc-500 line-through'"
                >
                  {{ ar.label }}
                </span>
              </div>
              <p v-if="!anyRatioEnabled" class="text-xs text-amber-400 mt-2">
                ⚠️ No ratios enabled - watermark won't be applied to any exports
              </p>
            </div>
          </div>

          <!-- Footer -->
          <div class="flex items-center justify-end gap-3 px-5 py-4 border-t border-zinc-800 bg-zinc-900/50 flex-shrink-0">
            <button
              @click="$emit('close')"
              class="px-5 py-2.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white rounded-xl transition-all duration-200 font-medium border border-zinc-700 hover:border-zinc-600"
            >
              Cancel
            </button>
            <button
              @click="savePosition"
              class="px-5 py-2.5 bg-gradient-to-r from-amber-600 to-orange-600 hover:from-amber-500 hover:to-orange-500 text-white rounded-xl font-semibold transition-all duration-200"
            >
              Save All Positions
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch, reactive } from 'vue';
import { invoke } from '@tauri-apps/api/core';
import { X, Move, Video, Monitor, Smartphone, Square, RectangleVertical, ChevronDown, Image as ImageIcon, Upload, Loader2 } from 'lucide-vue-next';
import { getAllWatermarkImages, type WatermarkImage } from '@/services/database';
import { useWatermarkOperations } from '@/composables/useWatermarkOperations';

// Types for watermark settings per aspect ratio
export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';

export interface CreatorWatermarkPosition {
  x: number;
  y: number;
  opacity: number;
  scale: number;
}

// Per-aspect-ratio watermark configuration (includes watermark ID AND position)
export interface CreatorWatermarkRatioConfig {
  watermarkId: string | null;
  position: CreatorWatermarkPosition | null;
}

// Settings can be null to indicate watermark is disabled for that ratio
// Each ratio can have a completely different watermark image
export interface CreatorWatermarkSettings {
  '16:9': CreatorWatermarkRatioConfig | null;
  '9:16': CreatorWatermarkRatioConfig | null;
  '1:1': CreatorWatermarkRatioConfig | null;
  '4:5': CreatorWatermarkRatioConfig | null;
}

interface Props {
  show: boolean;
  watermarkFilePath?: string; // Default watermark file path
  watermarkId?: string | null; // Default watermark ID
  watermarkWidth?: number | null;
  watermarkHeight?: number | null;
  settings?: CreatorWatermarkSettings;
}

const props = withDefaults(defineProps<Props>(), {
  settings: () => ({
    '16:9': { watermarkId: null, position: { x: 12, y: 92, opacity: 80, scale: 20 } },
    '9:16': null, // Disabled by default - only 16:9 is enabled
    '1:1': null,
    '4:5': null,
  }),
});

const defaultPosition: CreatorWatermarkPosition = { x: 12, y: 92, opacity: 80, scale: 20 };

const defaultSettings: CreatorWatermarkSettings = {
  '16:9': { watermarkId: null, position: { ...defaultPosition } },
  '9:16': { watermarkId: null, position: { ...defaultPosition } },
  '1:1': { watermarkId: null, position: { ...defaultPosition } },
  '4:5': { watermarkId: null, position: { ...defaultPosition } },
};

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'save', settings: CreatorWatermarkSettings): void;
}>();

// Watermark selection state
const watermarks = ref<WatermarkImage[]>([]);
const loadingWatermarks = ref(false);
const watermarkThumbnailCache = ref<Map<string, string>>(new Map());
const uploadingWatermark = ref(false);

// Watermark upload operations
const { uploadWatermark } = useWatermarkOperations();

// Aspect ratio configurations
const aspectRatios = [
  { id: '16:9' as AspectRatioId, label: '16:9', icon: Monitor, width: 16, height: 9 },
  { id: '9:16' as AspectRatioId, label: '9:16', icon: Smartphone, width: 9, height: 16 },
  { id: '1:1' as AspectRatioId, label: '1:1', icon: Square, width: 1, height: 1 },
  { id: '4:5' as AspectRatioId, label: '4:5', icon: RectangleVertical, width: 4, height: 5 },
];

const previewContainer = ref<HTMLElement | null>(null);
const isDragging = ref(false);
const watermarkDataUrl = ref<string | null>(null);
const loadingWatermark = ref(false);
const measuredWidth = ref<number | null>(null);
const measuredHeight = ref<number | null>(null);
const currentAspectRatio = ref<AspectRatioId>('16:9');
const isFullFrameWatermark = computed(() => {
  const w = props.watermarkWidth ?? measuredWidth.value;
  const h = props.watermarkHeight ?? measuredHeight.value;
  return w === 1920 && h === 1080;
});

// Track which aspect ratios have watermark enabled
const enabledRatios = reactive<Record<AspectRatioId, boolean>>({
  '16:9': true,
  '9:16': false,
  '1:1': false,
  '4:5': false,
});

// Per-ratio watermark IDs (can be different watermarks for different ratios)
const ratioWatermarkIds = reactive<Record<AspectRatioId, string | null>>({
  '16:9': null,
  '9:16': null,
  '1:1': null,
  '4:5': null,
});

// Local settings for all aspect ratios (stores position even when disabled, so user can toggle back)
const localSettings = reactive<Record<AspectRatioId, CreatorWatermarkPosition>>({
  '16:9': { ...defaultPosition },
  '9:16': { ...defaultPosition },
  '1:1': { ...defaultPosition },
  '4:5': { ...defaultPosition },
});

// Watermark dropdown state
const showWatermarkDropdown = ref(false);

// Check if any ratio is enabled
const anyRatioEnabled = computed(() => Object.values(enabledRatios).some(v => v));

// Presets for quick positioning (using 12/88 for corners to match default watermark position)
const presets = [
  { name: 'Top Left', x: 12, y: 8 },
  { name: 'Top Right', x: 88, y: 8 },
  { name: 'Center', x: 50, y: 50 },
  { name: 'Bottom Left', x: 12, y: 92 },
  { name: 'Bottom Right', x: 88, y: 92 },
];

// Current aspect ratio settings
const currentSettings = computed(() => localSettings[currentAspectRatio.value]);

const currentAspectRatioLabel = computed(() => {
  const ar = aspectRatios.find((a) => a.id === currentAspectRatio.value);
  return ar?.label || '16:9';
});

// Preview container style based on aspect ratio
const previewContainerStyle = computed(() => {
  const ar = aspectRatios.find((a) => a.id === currentAspectRatio.value);
  if (!ar) return { width: '100%', aspectRatio: '16/9' };
  
  // Calculate size to fit nicely in the container
  const maxWidth = currentAspectRatio.value === '16:9' ? '100%' : 
                   currentAspectRatio.value === '9:16' ? '200px' :
                   currentAspectRatio.value === '1:1' ? '300px' : '250px';
  
  return {
    width: maxWidth,
    aspectRatio: `${ar.width}/${ar.height}`,
  };
});

// Computed watermark style
const watermarkStyle = computed(() => {
  const settings = currentSettings.value;

  // Full-frame 1920x1080 canvases should fill the frame and sit at 0,0 so the baked position is preserved.
  if (isFullFrameWatermark.value) {
    return {
      left: '0%',
      top: '0%',
      transform: 'none',
      width: '100%',
      height: '100%',
    };
  }

  return {
    left: `${settings.x}%`,
    top: `${settings.y}%`,
    transform: 'translate(-50%, -50%)',
    width: `${settings.scale}%`,
    height: 'auto',
  };
});

// Load all available watermarks
async function loadWatermarks() {
  loadingWatermarks.value = true;
  try {
    watermarks.value = await getAllWatermarkImages();
    // Load thumbnails for all watermarks
    for (const wm of watermarks.value) {
      await loadWatermarkThumbnail(wm);
    }
  } catch (error) {
    console.error('[WatermarkPositionPicker] Failed to load watermarks:', error);
  } finally {
    loadingWatermarks.value = false;
  }
}

// Load a single watermark thumbnail
async function loadWatermarkThumbnail(wm: WatermarkImage): Promise<void> {
  if (watermarkThumbnailCache.value.has(wm.id)) return;
  
  try {
    const dataUrl = await invoke<string>('read_file_as_data_url', {
      filePath: wm.file_path,
    });
    watermarkThumbnailCache.value.set(wm.id, dataUrl);
  } catch (error) {
    console.warn('[WatermarkPositionPicker] Failed to load watermark thumbnail:', wm.id, error);
  }
}

// Get watermark URL by ID
function getWatermarkUrlById(wmId: string | null): string | null {
  if (!wmId) return watermarkDataUrl.value;
  return watermarkThumbnailCache.value.get(wmId) || null;
}

// Get watermark by ID
function getWatermarkById(wmId: string | null): WatermarkImage | null {
  if (!wmId) return null;
  return watermarks.value.find(w => w.id === wmId) || null;
}

// Get current ratio's selected watermark
const currentRatioWatermark = computed(() => {
  const wmId = ratioWatermarkIds[currentAspectRatio.value];
  return getWatermarkById(wmId);
});

// Get current ratio's watermark URL for display
const currentRatioWatermarkUrl = computed(() => {
  const wmId = ratioWatermarkIds[currentAspectRatio.value];
  return getWatermarkUrlById(wmId);
});

// Select watermark for current ratio
function selectWatermarkForRatio(wm: WatermarkImage | null) {
  ratioWatermarkIds[currentAspectRatio.value] = wm?.id || null;
  showWatermarkDropdown.value = false;
  
  // If selecting a watermark, also enable the ratio if not already enabled
  if (wm && !enabledRatios[currentAspectRatio.value]) {
    enabledRatios[currentAspectRatio.value] = true;
  }
  
  // Update the watermark preview
  loadWatermarkImageForRatio();
}

// Upload a new watermark and select it for the current ratio
async function uploadNewWatermark() {
  if (uploadingWatermark.value) return;
  
  uploadingWatermark.value = true;
  showWatermarkDropdown.value = false;
  
  try {
    const result = await uploadWatermark();
    
    if (result.success && result.watermarkId) {
      // Reload watermarks list
      await loadWatermarks();
      
      // Find the newly uploaded watermark
      const newWatermark = watermarks.value.find(w => w.id === result.watermarkId);
      
      if (newWatermark) {
        // Select it for the current ratio
        ratioWatermarkIds[currentAspectRatio.value] = newWatermark.id;
        
        // Enable the ratio if not already enabled
        if (!enabledRatios[currentAspectRatio.value]) {
          enabledRatios[currentAspectRatio.value] = true;
        }
        
        // Update the preview
        await loadWatermarkImageForRatio();
      }
    }
  } catch (err) {
    console.error('[WatermarkPositionPicker] Failed to upload watermark:', err);
  } finally {
    uploadingWatermark.value = false;
  }
}

// Load watermark image for current ratio
async function loadWatermarkImageForRatio() {
  const wmId = ratioWatermarkIds[currentAspectRatio.value];
  
  // If no specific watermark for this ratio, use the default
  if (!wmId) {
    await loadWatermarkImage();
    return;
  }
  
  // Load the specific watermark for this ratio
  const wm = getWatermarkById(wmId);
  if (!wm) {
    await loadWatermarkImage();
    return;
  }
  
  loadingWatermark.value = true;
  try {
    let dataUrl = watermarkThumbnailCache.value.get(wmId);
    if (!dataUrl) {
      dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: wm.file_path,
      });
      watermarkThumbnailCache.value.set(wmId, dataUrl);
    }
    watermarkDataUrl.value = dataUrl;
    
    // Measure dimensions
    measuredWidth.value = wm.width ?? null;
    measuredHeight.value = wm.height ?? null;
    
    if (!measuredWidth.value || !measuredHeight.value) {
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          measuredWidth.value = img.naturalWidth || null;
          measuredHeight.value = img.naturalHeight || null;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = dataUrl!;
      });
    }
  } catch (err) {
    console.error('[WatermarkPositionPicker] Failed to load ratio watermark:', err);
    // Fall back to default
    await loadWatermarkImage();
  } finally {
    loadingWatermark.value = false;
  }
}

// Load watermark image (default)
async function loadWatermarkImage() {
  if (!props.watermarkFilePath) {
    watermarkDataUrl.value = null;
    measuredWidth.value = null;
    measuredHeight.value = null;
    return;
  }

  loadingWatermark.value = true;
  try {
    const dataUrl = await invoke<string>('read_file_as_data_url', {
      filePath: props.watermarkFilePath,
    });
    watermarkDataUrl.value = dataUrl;

    // Also measure dimensions from the loaded image so we can detect 1920x1080 even if metadata is missing.
    await new Promise<void>((resolve) => {
      const img = new Image();
      img.onload = () => {
        measuredWidth.value = img.naturalWidth || null;
        measuredHeight.value = img.naturalHeight || null;
        resolve();
      };
      img.onerror = () => resolve();
      img.src = dataUrl;
    });
  } catch (err) {
    console.error('[WatermarkPositionPicker] Failed to load watermark:', err);
    watermarkDataUrl.value = null;
    measuredWidth.value = null;
    measuredHeight.value = null;
  } finally {
    loadingWatermark.value = false;
  }
}

// Initialize settings when dialog opens
watch(
  () => props.show,
  async (show) => {
    if (show) {
      // Load available watermarks
      await loadWatermarks();
      
      // Initialize local settings and enabled state from props
      const incoming = props.settings;
      
      // For each ratio, check if settings exist (not null) to determine enabled state
      for (const ar of aspectRatios) {
        const id = ar.id;
        const incomingConfig = incoming?.[id];
        
        if (incomingConfig !== null && incomingConfig !== undefined) {
          // Settings exist - ratio is enabled
          enabledRatios[id] = true;
          // Handle both old format (just position) and new format (watermarkId + position)
          if ('position' in incomingConfig && incomingConfig.position) {
            localSettings[id] = { ...incomingConfig.position };
            ratioWatermarkIds[id] = incomingConfig.watermarkId || null;
          } else if ('x' in incomingConfig && 'y' in incomingConfig && 'opacity' in incomingConfig && 'scale' in incomingConfig) {
            // Old format - just position values (has x, y, opacity, scale properties directly)
            const oldConfig = incomingConfig as { x: number; y: number; opacity: number; scale: number };
            localSettings[id] = { x: oldConfig.x, y: oldConfig.y, opacity: oldConfig.opacity, scale: oldConfig.scale };
            ratioWatermarkIds[id] = props.watermarkId || null;
          } else {
            localSettings[id] = { ...defaultPosition };
            ratioWatermarkIds[id] = null;
          }
        } else {
          // Settings are null - ratio is disabled, but use defaults for UI
          enabledRatios[id] = false;
          localSettings[id] = { ...defaultPosition };
          ratioWatermarkIds[id] = null;
        }
      }
      
      // If default watermark provided, use it for 16:9 if not already set
      if (props.watermarkId && !ratioWatermarkIds['16:9']) {
        ratioWatermarkIds['16:9'] = props.watermarkId;
      }
      
      // Start on the first enabled ratio, or default to 16:9
      const firstEnabled = aspectRatios.find(ar => enabledRatios[ar.id]);
      currentAspectRatio.value = firstEnabled?.id || '16:9';
      
      await loadWatermarkImageForRatio();
    }
  }
);

// Reload watermark if file path changes
watch(
  () => props.watermarkFilePath,
  async () => {
    if (props.show) {
      await loadWatermarkImage();
    }
  }
);

async function selectAspectRatio(id: AspectRatioId) {
  currentAspectRatio.value = id;
  // Reload watermark for the new ratio (may have different watermark image)
  await loadWatermarkImageForRatio();
}

function toggleCurrentRatio() {
  enabledRatios[currentAspectRatio.value] = !enabledRatios[currentAspectRatio.value];
}

function updateX(value: number) {
  localSettings[currentAspectRatio.value].x = value;
}

function updateY(value: number) {
  localSettings[currentAspectRatio.value].y = value;
}

function updateScale(value: number) {
  localSettings[currentAspectRatio.value].scale = value;
}

function updateOpacity(value: number) {
  localSettings[currentAspectRatio.value].opacity = value;
}

function handleClick(event: MouseEvent) {
  if (!previewContainer.value) return;
  updatePositionFromEvent(event);
}

function startDrag(event: MouseEvent) {
  isDragging.value = true;
  updatePositionFromEvent(event);
}

function handleDrag(event: MouseEvent) {
  if (!isDragging.value) return;
  updatePositionFromEvent(event);
}

function endDrag() {
  isDragging.value = false;
}

function updatePositionFromEvent(event: MouseEvent) {
  if (!previewContainer.value) return;

  const rect = previewContainer.value.getBoundingClientRect();
  const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
  const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));

  localSettings[currentAspectRatio.value].x = Math.round(x);
  localSettings[currentAspectRatio.value].y = Math.round(y);
}

function applyPreset(preset: { x: number; y: number }) {
  localSettings[currentAspectRatio.value].x = preset.x;
  localSettings[currentAspectRatio.value].y = preset.y;
}

function isPresetActive(preset: { x: number; y: number }): boolean {
  const settings = currentSettings.value;
  return settings.x === preset.x && settings.y === preset.y;
}

function copyToAllRatios() {
  const current = currentSettings.value;
  for (const ar of aspectRatios) {
    if (ar.id !== currentAspectRatio.value && enabledRatios[ar.id]) {
      localSettings[ar.id] = { ...current };
    }
  }
}

function handleImageError(event: Event) {
  const img = event.target as HTMLImageElement;
  img.style.display = 'none';
}

function savePosition() {
  // Only include settings for enabled ratios, null for disabled ones
  // Include both watermarkId and position for each enabled ratio
  emit('save', {
    '16:9': enabledRatios['16:9'] ? { watermarkId: ratioWatermarkIds['16:9'], position: { ...localSettings['16:9'] } } : null,
    '9:16': enabledRatios['9:16'] ? { watermarkId: ratioWatermarkIds['9:16'], position: { ...localSettings['9:16'] } } : null,
    '1:1': enabledRatios['1:1'] ? { watermarkId: ratioWatermarkIds['1:1'], position: { ...localSettings['1:1'] } } : null,
    '4:5': enabledRatios['4:5'] ? { watermarkId: ratioWatermarkIds['4:5'], position: { ...localSettings['4:5'] } } : null,
  });
  emit('close');
}
</script>

<style scoped>
/* Modal backdrop transition */
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}

/* Dialog transition */
.dialog-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.dialog-leave-active {
  transition: all 0.2s ease-in;
}

.dialog-enter-from {
  opacity: 0;
  transform: scale(0.95) translateY(10px);
}

.dialog-leave-to {
  opacity: 0;
  transform: scale(0.98);
}

/* Range slider styling */
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f59e0b;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  background: #f59e0b;
  cursor: pointer;
  border: 2px solid white;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}
</style>

