<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Sub-tabs -->
    <div class="flex items-center gap-1 py-2 px-1">
      <button
        @click="activeSubTab = 'settings'"
        :class="[
          'px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all',
          activeSubTab === 'settings'
            ? 'text-primary bg-primary/10 border border-primary/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent',
        ]"
      >
        Settings
      </button>
      <button
        @click="activeSubTab = 'presets'"
        :class="[
          'px-3 py-1.5 text-[11px] font-semibold rounded-md transition-all',
          activeSubTab === 'presets'
            ? 'text-primary bg-primary/10 border border-primary/30'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/30 border border-transparent',
        ]"
      >
        Presets
      </button>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto py-4 px-1 custom-scrollbar space-y-4">
      <!-- Presets Tab -->
      <template v-if="activeSubTab === 'presets'">
        <!-- Save Buttons -->
        <div class="flex items-center gap-2">
          <button
            @click="openSaveDialog('new')"
            class="flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border/50 hover:border-border text-foreground/80 hover:text-foreground"
            title="Save as a new preset"
          >
            <Plus class="h-3.5 w-3.5" />
            <span class="text-xs font-medium">New</span>
          </button>
          <button
            v-if="selectedPreset"
            @click="openSaveDialog('update')"
            class="flex-1 py-2 px-3 rounded-lg transition-all flex items-center justify-center gap-2 bg-muted/40 hover:bg-muted/60 border border-border/50 hover:border-border text-foreground/80 hover:text-foreground"
            :title="`Update ${selectedPreset.name}`"
          >
            <Upload class="h-3.5 w-3.5" />
            <span class="text-xs font-medium">Update</span>
          </button>
        </div>

        <!-- Empty State -->
        <div v-if="presets.length === 0" class="py-12 text-center">
          <div
            class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg flex items-center justify-center border border-primary/20"
          >
            <Star class="h-8 w-8 text-primary/60" />
          </div>
          <p class="text-sm text-muted-foreground mb-1">No presets saved yet</p>
          <p class="text-xs text-muted-foreground/70">Customize settings and save them as presets</p>
        </div>

        <!-- Preset List -->
        <div v-else class="space-y-2">
          <button
            v-for="preset in presets"
            :key="preset.id"
            @click="applyPreset(preset)"
            class="w-full p-3 rounded-lg border transition-all text-left group"
            :class="
              selectedPreset?.id === preset.id
                ? 'bg-primary/10 border-primary/30'
                : 'bg-muted/20 border-border/50 hover:bg-muted/40 hover:border-border'
            "
          >
            <div class="flex items-start justify-between">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="text-sm font-medium text-foreground truncate">{{ preset.name }}</span>
                  <CheckCircle v-if="selectedPreset?.id === preset.id" class="h-3.5 w-3.5 text-primary flex-shrink-0" />
                </div>
                <p v-if="preset.description" class="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                  {{ preset.description }}
                </p>
                <p class="text-[10px] text-muted-foreground/60 mt-1">
                  X: {{ Math.round((preset.position_x / 100) * 1920) }}px, Y:
                  {{ Math.round((preset.position_y / 100) * 1080) }}px • Opacity: {{ preset.opacity }}% • Width:
                  {{ Math.round((preset.scale / 100) * 1920) }}px
                </p>
              </div>
              <button
                @click.stop="deletePreset(preset)"
                class="p-1.5 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-500/20 transition-all"
                title="Delete preset"
              >
                <Trash2 class="h-3.5 w-3.5 text-red-400" />
              </button>
            </div>
          </button>
        </div>
      </template>

      <!-- Settings Tab -->
      <template v-if="activeSubTab === 'settings'">
        <!-- Watermark Selection -->
        <div class="space-y-2">
          <label class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Image</label>
          <div class="relative">
            <button
              ref="dropdownButtonRef"
              @click="toggleDropdown"
              class="w-full px-3 py-2.5 bg-muted/50 border border-border/40 rounded-lg text-left flex items-center justify-between hover:border-border hover:bg-muted/60 transition-all text-sm text-foreground"
            >
              <div class="flex items-center gap-3">
                <!-- Watermark thumbnail preview -->
                <div
                  v-if="selectedWatermark && getWatermarkUrl(selectedWatermark)"
                  class="w-8 h-8 rounded bg-muted/50 border border-border/30 flex items-center justify-center overflow-hidden"
                >
                  <img
                    :src="getWatermarkUrl(selectedWatermark)"
                    :alt="selectedWatermark.name"
                    class="max-w-full max-h-full object-contain"
                  />
                </div>
                <div
                  v-else
                  class="w-8 h-8 rounded bg-muted/30 border border-border/30 flex items-center justify-center"
                >
                  <ImageIcon class="w-4 h-4 text-muted-foreground/50" />
                </div>
                <span class="truncate">
                  {{ selectedWatermark ? selectedWatermark.name : 'Select a watermark...' }}
                </span>
              </div>
              <ChevronDown
                class="h-4 w-4 text-muted-foreground transition-transform flex-shrink-0 ml-2"
                :class="{ 'rotate-180': showDropdown }"
              />
            </button>

            <!-- Dropdown -->
            <Teleport to="body">
              <div
                v-if="showDropdown"
                ref="dropdownRef"
                class="fixed bg-card border border-border rounded-lg shadow-xl z-[9999] overflow-y-auto custom-scrollbar"
                :style="{
                  top: dropdownPosition.top,
                  left: dropdownPosition.left,
                  width: dropdownPosition.width,
                  maxHeight: dropdownPosition.maxHeight,
                }"
                @click.stop
              >
                <button
                  @click="selectWatermark(null)"
                  class="w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm border-b border-border/30 flex items-center gap-3"
                  :class="{ 'bg-primary/10 text-primary': !selectedWatermark }"
                >
                  <div class="w-8 h-8 rounded bg-muted/30 border border-border/30 flex items-center justify-center">
                    <X class="w-4 h-4 text-muted-foreground/50" />
                  </div>
                  <span>None</span>
                </button>
                <button
                  v-for="wm in watermarks"
                  :key="wm.id"
                  @click="selectWatermark(wm)"
                  class="w-full text-left px-3 py-2.5 hover:bg-muted/80 transition-colors text-sm flex items-center gap-3"
                  :class="{ 'bg-primary/10 text-primary': selectedWatermark?.id === wm.id }"
                >
                  <div
                    class="w-8 h-8 rounded bg-muted/50 border border-border/30 flex items-center justify-center overflow-hidden"
                  >
                    <img
                      v-if="getWatermarkUrl(wm)"
                      :src="getWatermarkUrl(wm)"
                      :alt="wm.name"
                      class="max-w-full max-h-full object-contain"
                    />
                    <ImageIcon v-else class="w-4 h-4 text-muted-foreground/50" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <span class="truncate block">{{ wm.name }}</span>
                    <span v-if="wm.width && wm.height" class="text-[10px] text-muted-foreground">
                      {{ wm.width }}×{{ wm.height }}
                    </span>
                  </div>
                </button>
                <div v-if="loading" class="px-3 py-4 text-sm text-center text-muted-foreground">
                  <Loader2 class="h-4 w-4 animate-spin mx-auto mb-2" />
                  Loading...
                </div>
                <div v-if="!loading && watermarks.length === 0" class="px-3 py-6 text-center">
                  <ImageIcon class="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                  <p class="text-sm text-muted-foreground">No watermarks available</p>
                  <p class="text-xs text-muted-foreground/70 mt-1">Upload watermarks in Assets</p>
                </div>
              </div>
            </Teleport>
          </div>
        </div>

        <!-- Settings (only when watermark selected) -->
        <template v-if="selectedWatermark && localSettings.enabled">
          <!-- Position Controls -->
          <div class="space-y-3">
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Position</h4>
              <span class="text-[9px] text-muted-foreground/60 bg-muted/30 px-1.5 py-0.5 rounded">1920×1080 ref</span>
            </div>

            <!-- Draggable Preview Area -->
            <div
              ref="previewAreaRef"
              class="relative bg-gradient-to-br from-muted/40 to-muted/20 rounded-lg border border-border/50 overflow-hidden cursor-crosshair"
              :style="{ aspectRatio: `${aspectRatio.width}/${aspectRatio.height}` }"
              @mousedown="startDrag"
              @touchstart.prevent="startDrag"
            >
              <!-- Grid lines -->
              <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-30">
                <div class="border-r border-b border-border/50"></div>
                <div class="border-r border-b border-border/50"></div>
                <div class="border-b border-border/50"></div>
                <div class="border-r border-b border-border/50"></div>
                <div class="border-r border-b border-border/50"></div>
                <div class="border-b border-border/50"></div>
                <div class="border-r border-border/50"></div>
                <div class="border-r border-border/50"></div>
                <div></div>
              </div>

              <!-- Watermark preview indicator -->
              <div
                v-if="selectedWatermark && getWatermarkUrl(selectedWatermark)"
                class="absolute transition-all duration-75 pointer-events-none"
                :style="getWatermarkPreviewStyle"
              >
                <img
                  :src="getWatermarkUrl(selectedWatermark)"
                  :alt="selectedWatermark.name"
                  class="max-w-full max-h-full object-contain drop-shadow-lg"
                  :style="{ opacity: localSettings.opacity / 100 }"
                />
              </div>
              <!-- Fallback indicator when image not loaded -->
              <div
                v-else-if="selectedWatermark"
                class="absolute w-6 h-6 bg-amber-500/80 rounded border-2 border-amber-400 shadow-lg transition-all duration-75 pointer-events-none"
                :style="{
                  left: `${isDragging ? dragPositionX : localSettings.positionX}%`,
                  top: `${isDragging ? dragPositionY : localSettings.positionY}%`,
                  transform: 'translate(-50%, -50%)',
                }"
              ></div>

              <!-- Center crosshair for reference -->
              <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-20">
                <div class="w-4 h-px bg-foreground"></div>
                <div class="w-px h-4 bg-foreground absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"></div>
              </div>

              <!-- Drag hint -->
              <div
                class="absolute bottom-2 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground/50 pointer-events-none"
              >
                Drag to position
              </div>
            </div>

            <!-- Position Sliders (pixel-based on 1920x1080 reference) -->
            <div class="grid grid-cols-2 gap-4">
              <!-- Horizontal (X) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-muted-foreground">X Position</label>
                  <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
                    {{ positionXPixels }}px
                  </span>
                </div>
                <div class="relative h-1.5 bg-muted-foreground/30 rounded-md">
                  <div
                    class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                    :style="{ width: `${(positionXPixels / 1920) * 100}%` }"
                  ></div>
                  <input
                    type="range"
                    v-model.number="positionXPixels"
                    min="0"
                    max="1920"
                    step="10"
                    class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                  />
                </div>
                <div class="flex justify-between text-[9px] text-muted-foreground/40">
                  <span>0</span>
                  <span>1920</span>
                </div>
              </div>

              <!-- Vertical (Y) -->
              <div class="space-y-1.5">
                <div class="flex items-center justify-between">
                  <label class="text-xs text-muted-foreground">Y Position</label>
                  <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
                    {{ positionYPixels }}px
                  </span>
                </div>
                <div class="relative h-1.5 bg-muted-foreground/30 rounded-md">
                  <div
                    class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                    :style="{ width: `${(positionYPixels / 1080) * 100}%` }"
                  ></div>
                  <input
                    type="range"
                    v-model.number="positionYPixels"
                    min="0"
                    max="1080"
                    step="10"
                    class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                  />
                </div>
                <div class="flex justify-between text-[9px] text-muted-foreground/40">
                  <span>0</span>
                  <span>1080</span>
                </div>
              </div>
            </div>

            <!-- Quick Position Presets -->
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="preset in positionPresets"
                :key="preset.name"
                @click="applyPositionPreset(preset)"
                class="px-2 py-1 text-[10px] font-medium rounded transition-all"
                :class="
                  isPresetActive(preset)
                    ? 'bg-primary/20 text-primary border border-primary/30'
                    : 'bg-muted/40 text-muted-foreground hover:bg-muted/60 border border-transparent'
                "
              >
                {{ preset.name }}
              </button>
            </div>
          </div>

          <!-- Opacity -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Opacity</h4>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ localSettings.opacity }}%
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((localSettings.opacity - 10) / (100 - 10)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="localSettings.opacity"
                min="10"
                max="100"
                step="5"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
            <div class="flex justify-between text-[9px] text-muted-foreground/40">
              <span>Subtle</span>
              <span>Full</span>
            </div>
          </div>

          <!-- Scale (width in pixels on 1920x1080 reference) -->
          <div class="space-y-2">
            <div class="flex items-center justify-between">
              <h4 class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Width</h4>
              <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
                {{ scalePixels }}px
              </span>
            </div>
            <div class="relative h-2 bg-muted-foreground/30 rounded-md">
              <div
                class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                :style="{ width: `${((scalePixels - 96) / (864 - 96)) * 100}%` }"
              ></div>
              <input
                type="range"
                v-model.number="scalePixels"
                min="96"
                max="864"
                step="10"
                class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
              />
            </div>
            <div class="flex justify-between text-[9px] text-muted-foreground/40">
              <span>96px</span>
              <span>864px</span>
            </div>
          </div>
        </template>

        <!-- Empty State when no watermark selected but enabled -->
        <div v-if="localSettings.enabled && !selectedWatermark" class="py-8 text-center">
          <div
            class="w-16 h-16 mx-auto mb-4 bg-gradient-to-br from-amber-500/10 to-orange-500/10 rounded-lg flex items-center justify-center border border-amber-500/20"
          >
            <ImageIcon class="h-8 w-8 text-amber-500/60" />
          </div>
          <p class="text-sm text-muted-foreground mb-1">Select a watermark image</p>
          <p class="text-xs text-muted-foreground/70">Choose from your uploaded watermarks above</p>
        </div>
      </template>
    </div>

    <!-- Save Preset Dialog -->
    <Teleport to="body">
      <div
        v-if="showSaveDialog"
        class="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[9999]"
      >
        <div class="bg-card rounded-xl w-full max-w-sm mx-4 border border-border shadow-2xl">
          <div class="px-4 py-3 border-b border-border/50">
            <h3 class="text-sm font-semibold text-foreground">
              {{ saveDialogMode === 'new' ? 'Save New Preset' : 'Update Preset' }}
            </h3>
          </div>
          <div class="p-4 space-y-3">
            <div>
              <label class="text-xs font-medium text-muted-foreground">Name</label>
              <input
                v-model="presetName"
                type="text"
                placeholder="My Watermark Preset"
                class="w-full mt-1 px-3 py-2 bg-muted/50 border border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
            <div>
              <label class="text-xs font-medium text-muted-foreground">Description (optional)</label>
              <input
                v-model="presetDescription"
                type="text"
                placeholder="Bottom right corner, semi-transparent"
                class="w-full mt-1 px-3 py-2 bg-muted/50 border border-border/40 rounded-lg text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary/50"
              />
            </div>
          </div>
          <div class="px-4 py-3 border-t border-border/50 flex justify-end gap-2">
            <button
              @click="closeSaveDialog"
              class="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              @click="savePreset"
              :disabled="!presetName.trim()"
              class="px-4 py-1.5 text-xs font-medium bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {{ saveDialogMode === 'new' ? 'Save' : 'Update' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import {
    RotateCcw,
    ChevronDown,
    X,
    Loader2,
    Image as ImageIcon,
    Plus,
    Upload,
    Star,
    CheckCircle,
    Trash2,
  } from 'lucide-vue-next';
  import {
    getAllWatermarkImages,
    type WatermarkImage,
    getAllWatermarkPresets,
    createWatermarkPreset,
    updateWatermarkPreset,
    deleteWatermarkPreset as deletePresetFromDb,
    presetToWatermarkSettings,
    type WatermarkPreset,
  } from '@/services/database';
  import type { WatermarkSettings } from '@/types';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    projectId: string | null;
    settings: WatermarkSettings;
    aspectRatio: { width: number; height: number };
    hideHeader?: boolean;
  }

  const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    settings: () => ({
      enabled: false,
      watermarkId: null,
      positionX: 12,
      positionY: 92,
      opacity: 80,
      scale: 20,
    }),
    aspectRatio: () => ({ width: 16, height: 9 }),
    hideHeader: false,
  });

  const emit = defineEmits<{
    'settings-changed': [settings: WatermarkSettings];
  }>();

  // Reference frame constants (all positioning is based on 1920x1080)
  const REFERENCE_WIDTH = 1920;
  const REFERENCE_HEIGHT = 1080;

  // Local settings state
  const localSettings = ref<WatermarkSettings>({ ...props.settings });

  // Pixel-based position computed properties (convert to/from percentages)
  const positionXPixels = computed({
    get: () => Math.round((localSettings.value.positionX / 100) * REFERENCE_WIDTH),
    set: (px: number) => {
      localSettings.value.positionX = Math.round((px / REFERENCE_WIDTH) * 100);
    },
  });

  const positionYPixels = computed({
    get: () => Math.round((localSettings.value.positionY / 100) * REFERENCE_HEIGHT),
    set: (px: number) => {
      localSettings.value.positionY = Math.round((px / REFERENCE_HEIGHT) * 100);
    },
  });

  // Scale in pixels (based on percentage of reference width)
  const scalePixels = computed({
    get: () => Math.round((localSettings.value.scale / 100) * REFERENCE_WIDTH),
    set: (px: number) => {
      localSettings.value.scale = Math.round((px / REFERENCE_WIDTH) * 100);
    },
  });

  // Watermark data
  const watermarks = ref<WatermarkImage[]>([]);
  const selectedWatermark = ref<WatermarkImage | null>(null);
  const loading = ref(false);
  const watermarkThumbnailCache = ref<Map<string, string>>(new Map());

  // Sub-tab state
  const activeSubTab = ref<'settings' | 'presets'>('settings');

  // Preset state
  const presets = ref<WatermarkPreset[]>([]);
  const selectedPreset = ref<WatermarkPreset | null>(null);
  const showSaveDialog = ref(false);
  const saveDialogMode = ref<'new' | 'update'>('new');
  const presetName = ref('');
  const presetDescription = ref('');

  // Dropdown state
  const showDropdown = ref(false);
  const dropdownButtonRef = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const dropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '256px' });

  // Drag state
  const previewAreaRef = ref<HTMLElement | null>(null);
  const isDragging = ref(false);

  // Position presets in pixels (based on 1920x1080 reference frame)
  // These are common positions with safe margins from edges
  const positionPresets = [
    { name: 'Top Left', x: 230, y: 86 }, // ~12%, 8%
    { name: 'Top Center', x: 960, y: 86 }, // 50%, 8%
    { name: 'Top Right', x: 1690, y: 86 }, // ~88%, 8%
    { name: 'Center', x: 960, y: 540 }, // 50%, 50%
    { name: 'Bottom Left', x: 230, y: 994 }, // ~12%, 92%
    { name: 'Bottom Center', x: 960, y: 994 }, // 50%, 92%
    { name: 'Bottom Right', x: 1690, y: 994 }, // ~88%, 92%
  ];

  // Computed
  const measuredWidth = ref<number | null>(null);
  const measuredHeight = ref<number | null>(null);

  const isFullFrameWatermark = computed(() => {
    if (!selectedWatermark.value) return false;
    const w = selectedWatermark.value.width ?? measuredWidth.value;
    const h = selectedWatermark.value.height ?? measuredHeight.value;
    return w === 1920 && h === 1080;
  });

  const getWatermarkPreviewStyle = computed(() => {
    // When the watermark is a full-frame 1920x1080 canvas, show it filling the preview
    if (isFullFrameWatermark.value) {
      return {
        width: '100%',
        height: '100%',
        left: '0%',
        top: '0%',
        transform: 'none',
      };
    }

    // Standard behavior: scale relative to container width and center on X/Y percentages
    const sizePercent = localSettings.value.scale;
    const posX = isDragging.value ? dragPositionX.value : localSettings.value.positionX;
    const posY = isDragging.value ? dragPositionY.value : localSettings.value.positionY;

    return {
      width: `${sizePercent}%`,
      left: `${posX}%`,
      top: `${posY}%`,
      transform: 'translate(-50%, -50%)',
    };
  });

  // Load watermarks
  async function loadWatermarks() {
    loading.value = true;
    try {
      watermarks.value = await getAllWatermarkImages();

      // Load thumbnails for all watermarks
      for (const wm of watermarks.value) {
        await loadWatermarkThumbnail(wm);
      }

      // If we have a watermarkId in settings, find and select it
      if (localSettings.value.watermarkId) {
        const found = watermarks.value.find((w) => w.id === localSettings.value.watermarkId);
        if (found) {
          selectedWatermark.value = found;
        }
      }
    } catch (error) {
      console.error('[WatermarkTab] Failed to load watermarks:', error);
    } finally {
      loading.value = false;
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

      // If this watermark is selected, also measure its intrinsic size for full-frame detection
      if (selectedWatermark.value?.id === wm.id) {
        await measureSelectedWatermark(dataUrl);
      }
    } catch (error) {
      console.warn('[WatermarkTab] Failed to load watermark thumbnail:', wm.id, error);
    }
  }

  // Get watermark URL for display
  function getWatermarkUrl(wm: WatermarkImage): string {
    return watermarkThumbnailCache.value.get(wm.id) || '';
  }

  // Toggle watermark enabled
  function toggleWatermark() {
    localSettings.value.enabled = !localSettings.value.enabled;
    emitSettings();
  }

  // Reset to defaults (position 230x994 = ~12%, 92% - bottom left with margin)
  function resetToDefaults() {
    localSettings.value = {
      enabled: false,
      watermarkId: null,
      positionX: 12, // 230px on 1920
      positionY: 92, // 994px on 1080
      opacity: 80,
      scale: 20, // 384px width on 1920
      perRatioSettings: localSettings.value.perRatioSettings, // Preserve creator profile settings
    };
    selectedWatermark.value = null;
    emitSettings();
  }

  // Dropdown handling
  function toggleDropdown() {
    if (!showDropdown.value && dropdownButtonRef.value) {
      const rect = dropdownButtonRef.value.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const spaceBelow = viewportHeight - rect.bottom;
      const dropdownHeight = 256;

      let top: string;
      if (spaceBelow < dropdownHeight && rect.top > spaceBelow) {
        top = `${rect.top - dropdownHeight - 4}px`;
      } else {
        top = `${rect.bottom + 4}px`;
      }

      dropdownPosition.value = {
        top,
        left: `${rect.left}px`,
        width: `${rect.width}px`,
        maxHeight: `${Math.min(dropdownHeight, Math.max(spaceBelow, rect.top) - 8)}px`,
      };
    }
    showDropdown.value = !showDropdown.value;
  }

  async function measureSelectedWatermark(dataUrl: string) {
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
  }

  async function selectWatermark(wm: WatermarkImage | null) {
    selectedWatermark.value = wm;
    measuredWidth.value = wm?.width ?? null;
    measuredHeight.value = wm?.height ?? null;
    localSettings.value.watermarkId = wm?.id || null;
    showDropdown.value = false;
    if (wm) {
      const dataUrl = watermarkThumbnailCache.value.get(wm.id);
      if (dataUrl) {
        await measureSelectedWatermark(dataUrl);
      } else {
        // Load thumbnail (and measure) if not already cached
        await loadWatermarkThumbnail(wm);
        const loaded = watermarkThumbnailCache.value.get(wm.id);
        if (loaded) {
          await measureSelectedWatermark(loaded);
        }
      }
    }
    emitSettings();
  }

  // Ensure measurement when a selected watermark already exists (e.g., from creator profile defaults)
  async function ensureMeasurementForSelected() {
    if (!selectedWatermark.value) return;
    // If dimensions are already known and match 1920x1080, keep them
    if (selectedWatermark.value.width && selectedWatermark.value.height) {
      measuredWidth.value = selectedWatermark.value.width;
      measuredHeight.value = selectedWatermark.value.height;
      return;
    }
    const cached = watermarkThumbnailCache.value.get(selectedWatermark.value.id);
    if (cached) {
      await measureSelectedWatermark(cached);
      return;
    }
    // Fallback: load and measure
    await loadWatermarkThumbnail(selectedWatermark.value);
  }

  // Position preset handling (presets are in pixels, convert to percentages for storage)
  function applyPositionPreset(preset: { name: string; x: number; y: number }) {
    positionXPixels.value = preset.x;
    positionYPixels.value = preset.y;
    emitSettings();
  }

  function isPresetActive(preset: { name: string; x: number; y: number }): boolean {
    // Compare in pixel space (allow ~50px tolerance)
    return Math.abs(positionXPixels.value - preset.x) < 50 && Math.abs(positionYPixels.value - preset.y) < 50;
  }

  // Drag handling - use local refs to avoid triggering watchers during drag
  const dragPositionX = ref(localSettings.value.positionX);
  const dragPositionY = ref(localSettings.value.positionY);

  function startDrag(event: MouseEvent | TouchEvent) {
    if (!previewAreaRef.value) return;

    isDragging.value = true;
    dragPositionX.value = localSettings.value.positionX;
    dragPositionY.value = localSettings.value.positionY;
    updatePositionFromEvent(event);

    document.addEventListener('mousemove', onDrag);
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchmove', onDrag, { passive: true });
    document.addEventListener('touchend', stopDrag);
  }

  function onDrag(event: MouseEvent | TouchEvent) {
    if (!isDragging.value) return;
    updatePositionFromEvent(event);
  }

  function stopDrag() {
    if (!isDragging.value) return;

    isDragging.value = false;
    document.removeEventListener('mousemove', onDrag);
    document.removeEventListener('mouseup', stopDrag);
    document.removeEventListener('touchmove', onDrag);
    document.removeEventListener('touchend', stopDrag);

    // Apply the final position
    localSettings.value.positionX = dragPositionX.value;
    localSettings.value.positionY = dragPositionY.value;
    emitSettings();
  }

  function updatePositionFromEvent(event: MouseEvent | TouchEvent) {
    if (!previewAreaRef.value) return;

    const rect = previewAreaRef.value.getBoundingClientRect();
    let clientX: number, clientY: number;

    if ('touches' in event) {
      clientX = event.touches[0].clientX;
      clientY = event.touches[0].clientY;
    } else {
      clientX = event.clientX;
      clientY = event.clientY;
    }

    const x = ((clientX - rect.left) / rect.width) * 100;
    const y = ((clientY - rect.top) / rect.height) * 100;

    // Update drag refs directly (no watcher triggers)
    dragPositionX.value = Math.max(0, Math.min(100, Math.round(x)));
    dragPositionY.value = Math.max(0, Math.min(100, Math.round(y)));
  }

  // Click outside handler
  function handleClickOutside(event: MouseEvent) {
    const target = event.target as Node;
    if (
      showDropdown.value &&
      dropdownButtonRef.value &&
      !dropdownButtonRef.value.contains(target) &&
      dropdownRef.value &&
      !dropdownRef.value.contains(target)
    ) {
      showDropdown.value = false;
    }
  }

  // Emit settings to parent
  function emitSettings() {
    emit('settings-changed', { ...localSettings.value });
  }

  // Debounced emit for slider changes (prevents lag)
  let emitTimeout: ReturnType<typeof setTimeout> | null = null;
  function emitSettingsDebounced() {
    if (emitTimeout) {
      clearTimeout(emitTimeout);
    }
    emitTimeout = setTimeout(() => {
      emitSettings();
    }, 50); // 50ms debounce for smooth slider updates
  }

  // Watch for prop changes
  watch(
    () => props.settings,
    (newSettings) => {
      localSettings.value = { ...newSettings };
      // Update selected watermark if ID changed
      if (newSettings.watermarkId) {
        const found = watermarks.value.find((w) => w.id === newSettings.watermarkId);
        if (found) {
          selectedWatermark.value = found;
          ensureMeasurementForSelected();
        }
      } else {
        selectedWatermark.value = null;
      }
    },
    { deep: true }
  );

  // Watch local settings changes for sliders (but not during drag)
  watch(
    () => [
      localSettings.value.positionX,
      localSettings.value.positionY,
      localSettings.value.opacity,
      localSettings.value.scale,
    ],
    () => {
      // Don't emit during drag - stopDrag handles that
      if (!isDragging.value) {
        emitSettingsDebounced();
      }
    }
  );

  // Load presets
  async function loadPresets() {
    try {
      presets.value = await getAllWatermarkPresets();
    } catch (error) {
      console.error('[WatermarkTab] Failed to load presets:', error);
    }
  }

  // Apply a preset
  function applyPreset(preset: WatermarkPreset) {
    selectedPreset.value = preset;
    const settings = presetToWatermarkSettings(preset);

    // Apply settings but keep enabled state and perRatioSettings (from creator profile)
    localSettings.value = {
      ...settings,
      enabled: localSettings.value.enabled,
      perRatioSettings: localSettings.value.perRatioSettings, // Preserve creator profile settings
    };

    // Update selected watermark if preset has one
    if (preset.watermark_id) {
      const found = watermarks.value.find((w) => w.id === preset.watermark_id);
      if (found) {
        selectedWatermark.value = found;
      }
    }

    emitSettings();
  }

  // Open save dialog
  function openSaveDialog(mode: 'new' | 'update') {
    saveDialogMode.value = mode;
    if (mode === 'update' && selectedPreset.value) {
      presetName.value = selectedPreset.value.name;
      presetDescription.value = selectedPreset.value.description || '';
    } else {
      presetName.value = '';
      presetDescription.value = '';
    }
    showSaveDialog.value = true;
  }

  // Close save dialog
  function closeSaveDialog() {
    showSaveDialog.value = false;
    presetName.value = '';
    presetDescription.value = '';
  }

  // Save preset
  async function savePreset() {
    if (!presetName.value.trim()) return;

    try {
      if (saveDialogMode.value === 'new') {
        const id = await createWatermarkPreset(
          presetName.value.trim(),
          presetDescription.value.trim() || null,
          localSettings.value
        );
        await loadPresets();
        // Select the newly created preset
        const newPreset = presets.value.find((p) => p.id === id);
        if (newPreset) {
          selectedPreset.value = newPreset;
        }
      } else if (selectedPreset.value) {
        await updateWatermarkPreset(
          selectedPreset.value.id,
          presetName.value.trim(),
          presetDescription.value.trim() || null,
          localSettings.value
        );
        await loadPresets();
        // Update selected preset reference
        const updated = presets.value.find((p) => p.id === selectedPreset.value?.id);
        if (updated) {
          selectedPreset.value = updated;
        }
      }
      closeSaveDialog();
    } catch (error) {
      console.error('[WatermarkTab] Failed to save preset:', error);
    }
  }

  // Delete preset
  async function deletePreset(preset: WatermarkPreset) {
    try {
      await deletePresetFromDb(preset.id);
      if (selectedPreset.value?.id === preset.id) {
        selectedPreset.value = null;
      }
      await loadPresets();
    } catch (error) {
      console.error('[WatermarkTab] Failed to delete preset:', error);
    }
  }

  onMounted(async () => {
    await Promise.all([loadWatermarks(), loadPresets()]);
    await ensureMeasurementForSelected();
    document.addEventListener('click', handleClickOutside);
  });

  onUnmounted(() => {
    document.removeEventListener('click', handleClickOutside);
    // Clean up debounce timeout
    if (emitTimeout) {
      clearTimeout(emitTimeout);
    }
  });

  // Expose methods
  defineExpose({
    getSelectedWatermark: () => selectedWatermark.value,
    getSettings: () => localSettings.value,
    resetToDefaults,
  });
</script>

<style scoped>
  .custom-scrollbar::-webkit-scrollbar {
    width: 6px;
  }

  .custom-scrollbar::-webkit-scrollbar-track {
    background: transparent;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb {
    background: hsl(var(--muted-foreground) / 0.2);
    border-radius: 3px;
  }

  .custom-scrollbar::-webkit-scrollbar-thumb:hover {
    background: hsl(var(--muted-foreground) / 0.4);
  }

  /* Slider styling - matches SubtitlesTab pattern */
  .slider {
    -webkit-appearance: none;
    appearance: none;
    background: transparent;
    cursor: pointer;
    outline: none;
  }

  .slider::-webkit-slider-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
  }

  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    appearance: none;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-webkit-slider-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-webkit-slider-thumb:active {
    transform: scale(1.1);
  }

  .slider::-moz-range-track {
    background: transparent;
    height: 8px;
    border-radius: 4px;
    border: none;
  }

  .slider::-moz-range-thumb {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: white;
    cursor: pointer;
    border: none;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
    transition: all 0.2s ease;
  }

  .slider::-moz-range-thumb:hover {
    transform: scale(1.2);
    box-shadow: 0 2px 6px rgba(0, 0, 0, 0.4);
  }

  .slider::-moz-range-thumb:active {
    transform: scale(1.1);
  }

  .slider::-moz-range-progress {
    background: hsl(var(--primary));
    height: 8px;
    border-radius: 4px 0 0 4px;
  }
</style>
