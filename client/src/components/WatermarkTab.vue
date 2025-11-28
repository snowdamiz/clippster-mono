<template>
  <div class="flex-1 flex flex-col overflow-hidden">
    <!-- Header with Enable Toggle -->
    <div class="py-3 bg-card/30">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-3">
          <button
            @click="toggleWatermark"
            type="button"
            :class="[
              'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-primary/30',
              localSettings.enabled ? 'bg-primary' : 'bg-muted-foreground/30',
            ]"
            :title="localSettings.enabled ? 'Disable watermark' : 'Enable watermark'"
            :aria-pressed="localSettings.enabled"
          >
            <span
              :class="[
                'inline-block h-5 w-5 transform rounded-full bg-white shadow-lg transition-all duration-200 ease-in-out',
                localSettings.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
              ]"
            ></span>
          </button>
          <div>
            <span class="text-sm font-semibold text-foreground">
              {{ localSettings.enabled ? 'Enabled' : 'Disabled' }}
            </span>
            <p class="text-[10px] text-muted-foreground mt-0.5">
              {{ localSettings.enabled ? 'Watermark preview active' : 'Turn on to preview watermark' }}
            </p>
          </div>
        </div>
        <button
          @click="resetToDefaults"
          class="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted/40 hover:bg-muted/60 rounded-md transition-all border border-border/50"
          title="Reset all settings to defaults"
        >
          <RotateCcw class="h-3.5 w-3.5" />
          Reset
        </button>
      </div>
    </div>

    <!-- Content -->
    <div class="flex-1 overflow-y-auto py-4 custom-scrollbar space-y-4">
      <!-- Watermark Selection -->
      <div class="space-y-2">
        <label class="text-xs font-semibold text-foreground uppercase tracking-wide">Image</label>
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
              <div v-else class="w-8 h-8 rounded bg-muted/30 border border-border/30 flex items-center justify-center">
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
          <label class="text-xs font-semibold text-foreground uppercase tracking-wide">Position</label>

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

          <!-- Position Sliders -->
          <div class="grid grid-cols-2 gap-4">
            <!-- Horizontal -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs text-muted-foreground">Horizontal</label>
                <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
                  {{ localSettings.positionX }}%
                </span>
              </div>
              <div class="relative h-1.5 bg-muted-foreground/30 rounded-md">
                <div
                  class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                  :style="{ width: `${localSettings.positionX}%` }"
                ></div>
                <input
                  type="range"
                  v-model.number="localSettings.positionX"
                  min="0"
                  max="100"
                  step="1"
                  class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                />
              </div>
              <div class="flex justify-between text-[9px] text-muted-foreground/40">
                <span>Left</span>
                <span>Right</span>
              </div>
            </div>

            <!-- Vertical -->
            <div class="space-y-1.5">
              <div class="flex items-center justify-between">
                <label class="text-xs text-muted-foreground">Vertical</label>
                <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-1.5 py-0.5 rounded">
                  {{ localSettings.positionY }}%
                </span>
              </div>
              <div class="relative h-1.5 bg-muted-foreground/30 rounded-md">
                <div
                  class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
                  :style="{ width: `${localSettings.positionY}%` }"
                ></div>
                <input
                  type="range"
                  v-model.number="localSettings.positionY"
                  min="0"
                  max="100"
                  step="1"
                  class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
                />
              </div>
              <div class="flex justify-between text-[9px] text-muted-foreground/40">
                <span>Top</span>
                <span>Bottom</span>
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
            <label class="text-xs font-semibold text-foreground uppercase tracking-wide">Opacity</label>
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

        <!-- Scale -->
        <div class="space-y-2">
          <div class="flex items-center justify-between">
            <label class="text-xs font-semibold text-foreground uppercase tracking-wide">Size</label>
            <span class="text-xs font-mono text-foreground/70 bg-muted/50 px-2 py-1 rounded">
              {{ localSettings.scale }}%
            </span>
          </div>
          <div class="relative h-2 bg-muted-foreground/30 rounded-md">
            <div
              class="absolute left-0 top-0 h-full bg-primary rounded-md transition-all duration-200"
              :style="{ width: `${((localSettings.scale - 5) / (50 - 5)) * 100}%` }"
            ></div>
            <input
              type="range"
              v-model.number="localSettings.scale"
              min="5"
              max="50"
              step="1"
              class="absolute inset-0 w-full h-full cursor-pointer slider z-10"
            />
          </div>
          <div class="flex justify-between text-[9px] text-muted-foreground/40">
            <span>Small</span>
            <span>Large</span>
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
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, watch, computed, onMounted, onUnmounted } from 'vue';
  import { RotateCcw, ChevronDown, X, Loader2, Image as ImageIcon } from 'lucide-vue-next';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database';
  import type { WatermarkSettings } from '@/types';
  import { invoke } from '@tauri-apps/api/core';

  interface Props {
    projectId: string | null;
    settings: WatermarkSettings;
    aspectRatio: { width: number; height: number };
  }

  const props = withDefaults(defineProps<Props>(), {
    projectId: null,
    settings: () => ({
      enabled: false,
      watermarkId: null,
      positionX: 90,
      positionY: 90,
      opacity: 80,
      scale: 15,
    }),
    aspectRatio: () => ({ width: 16, height: 9 }),
  });

  const emit = defineEmits<{
    'settings-changed': [settings: WatermarkSettings];
  }>();

  // Local settings state
  const localSettings = ref<WatermarkSettings>({ ...props.settings });

  // Watermark data
  const watermarks = ref<WatermarkImage[]>([]);
  const selectedWatermark = ref<WatermarkImage | null>(null);
  const loading = ref(false);
  const watermarkThumbnailCache = ref<Map<string, string>>(new Map());

  // Dropdown state
  const showDropdown = ref(false);
  const dropdownButtonRef = ref<HTMLElement | null>(null);
  const dropdownRef = ref<HTMLElement | null>(null);
  const dropdownPosition = ref({ top: '0px', left: '0px', width: '0px', maxHeight: '256px' });

  // Drag state
  const previewAreaRef = ref<HTMLElement | null>(null);
  const isDragging = ref(false);

  // Position presets
  const positionPresets = [
    { name: 'Top Left', x: 8, y: 8 },
    { name: 'Top Center', x: 50, y: 8 },
    { name: 'Top Right', x: 92, y: 8 },
    { name: 'Center', x: 50, y: 50 },
    { name: 'Bottom Left', x: 8, y: 92 },
    { name: 'Bottom Center', x: 50, y: 92 },
    { name: 'Bottom Right', x: 92, y: 92 },
  ];

  // Computed
  const getWatermarkPreviewStyle = computed(() => {
    // Calculate size based on scale (percentage of container width)
    const sizePercent = localSettings.value.scale;

    // Use drag refs during dragging for smooth preview, otherwise use localSettings
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

  // Reset to defaults
  function resetToDefaults() {
    localSettings.value = {
      enabled: false,
      watermarkId: null,
      positionX: 90,
      positionY: 90,
      opacity: 80,
      scale: 15,
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

  function selectWatermark(wm: WatermarkImage | null) {
    selectedWatermark.value = wm;
    localSettings.value.watermarkId = wm?.id || null;
    showDropdown.value = false;
    emitSettings();
  }

  // Position preset handling
  function applyPositionPreset(preset: { name: string; x: number; y: number }) {
    localSettings.value.positionX = preset.x;
    localSettings.value.positionY = preset.y;
    emitSettings();
  }

  function isPresetActive(preset: { name: string; x: number; y: number }): boolean {
    return (
      Math.abs(localSettings.value.positionX - preset.x) < 3 && Math.abs(localSettings.value.positionY - preset.y) < 3
    );
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

  onMounted(async () => {
    await loadWatermarks();
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
