<template>
  <Teleport to="body">
  <Transition name="modal">
    <div v-if="show" class="fixed inset-0 z-[10002] flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-black/70 backdrop-blur-[4px]" @click="$emit('close')"></div>
      <Transition name="dialog" appear>
        <div
          class="relative flex flex-col w-full max-w-2xl mx-3 overflow-hidden bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-xl max-h-[90vh] shadow-[0_20px_60px_rgba(0,0,0,0.4)]"
        >
          <!-- Accent bar -->
          <div class="h-[3px] w-full flex-shrink-0 bg-gradient-to-r from-[var(--sidebar-accent)] to-[#06b6d4]/50"></div>
          <!-- Header -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)] flex-shrink-0"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-lg bg-[rgba(6,182,212,0.15)] flex items-center justify-center"
              >
                <Move class="h-4 w-4 text-[var(--sidebar-accent)]" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-[var(--sidebar-text)]">Watermark Position</h2>
              </div>
            </div>
            <button
              @click="$emit('close')"
              class="p-1.5 rounded-lg text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] transition-colors"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Content -->
          <div class="flex-1 overflow-y-auto p-4">
            <!-- Aspect Ratio Tabs -->
            <div class="flex items-center gap-1.5 mb-3">
              <button
                v-for="ar in aspectRatios"
                :key="ar.id"
                @click="selectAspectRatio(ar.id)"
                class="px-2.5 py-1 text-xs font-medium rounded-md transition-all flex items-center gap-1 relative"
                :class="[
                  currentAspectRatio === ar.id
                    ? 'bg-[rgba(6,182,212,0.15)] text-[var(--sidebar-accent)] border border-[rgba(6,182,212,0.2)]'
                    : enabledRatios[ar.id]
                      ? 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text)] hover:bg-[var(--sidebar-active)] border border-[var(--sidebar-border)]'
                      : 'bg-transparent text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)] hover:bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)]',
                ]"
              >
                <component :is="ar.icon" class="w-3 h-3" />
                {{ ar.label }}
                <span
                  v-if="enabledRatios[ar.id]"
                  class="w-1.5 h-1.5 rounded-full bg-green-500 absolute -top-0.5 -right-0.5"
                ></span>
              </button>

              <!-- Enable Toggle -->
              <div class="ml-auto flex items-center gap-2">
                <span class="text-[10px] text-[var(--sidebar-text-muted)]">
                  {{ enabledRatios[currentAspectRatio] ? 'Enabled' : 'Disabled' }}
                </span>
                <button
                  @click="toggleCurrentRatio"
                  class="relative w-9 h-5 rounded-full transition-colors border border-[var(--sidebar-border)]"
                  :class="enabledRatios[currentAspectRatio] ? 'bg-[var(--sidebar-accent)]' : 'bg-[var(--sidebar-hover)]'"
                >
                  <span
                    class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform"
                    :class="enabledRatios[currentAspectRatio] ? 'translate-x-[18px]' : 'translate-x-0'"
                  ></span>
                </button>
              </div>
            </div>

            <!-- Settings Row (Watermark Selection + Full-frame toggle) -->
            <div v-if="enabledRatios[currentAspectRatio]" class="flex gap-3 mb-3">
              <!-- Watermark Selection -->
              <div class="flex-1 relative">
                <button
                  type="button"
                  @click.stop="showWatermarkDropdown = !showWatermarkDropdown"
                  class="w-full px-2.5 py-2 bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] rounded-lg text-left flex items-center justify-between hover:border-[var(--sidebar-text-muted)] transition-all text-xs text-[var(--sidebar-text)]"
                >
                  <div class="flex items-center gap-2">
                    <div
                      v-if="currentRatioWatermarkUrl"
                      class="w-6 h-6 rounded bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] flex items-center justify-center overflow-hidden flex-shrink-0"
                    >
                      <img
                        :src="currentRatioWatermarkUrl"
                        :alt="currentRatioWatermark?.name || 'Default'"
                        class="max-w-full max-h-full object-contain"
                      />
                    </div>
                    <div
                      v-else
                      class="w-6 h-6 rounded bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] flex items-center justify-center flex-shrink-0"
                    >
                      <ImageIcon class="w-3 h-3 text-[var(--sidebar-text-muted)]" />
                    </div>
                    <span class="truncate">
                      {{ currentRatioWatermark?.name || 'Default watermark' }}
                    </span>
                  </div>
                  <ChevronDown
                    class="h-3.5 w-3.5 text-[var(--sidebar-text-muted)] transition-transform flex-shrink-0 ml-1"
                    :class="{ 'rotate-180': showWatermarkDropdown }"
                  />
                </button>

                <!-- Watermark Dropdown -->
                <div
                  v-if="showWatermarkDropdown"
                  class="absolute top-full left-0 right-0 mt-1 bg-[var(--sidebar-surface)] border border-[var(--sidebar-border)] rounded-lg shadow-xl z-50 overflow-y-auto max-h-40 custom-scrollbar"
                  @click.stop
                >
                  <!-- Use default option -->
                  <button
                    @click="selectWatermarkForRatio(null)"
                    class="w-full text-left px-2.5 py-2 hover:bg-[var(--sidebar-hover)] transition-colors text-xs flex items-center gap-2 border-b border-[var(--sidebar-border)]"
                    :class="{ 'bg-[rgba(6,182,212,0.15)] text-[var(--sidebar-accent)]': !ratioWatermarkIds[currentAspectRatio] }"
                  >
                    <div class="w-6 h-6 rounded bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] flex items-center justify-center">
                      <ImageIcon class="w-3 h-3 text-[var(--sidebar-text-muted)]" />
                    </div>
                    <span class="text-[var(--sidebar-text)]">Default watermark</span>
                  </button>

                  <!-- Watermark options -->
                  <button
                    v-for="wm in watermarks"
                    :key="wm.id"
                    @click="selectWatermarkForRatio(wm)"
                    class="w-full text-left px-2.5 py-2 hover:bg-[var(--sidebar-hover)] transition-colors text-xs flex items-center gap-2"
                    :class="{ 'bg-[rgba(6,182,212,0.15)] text-[var(--sidebar-accent)]': ratioWatermarkIds[currentAspectRatio] === wm.id }"
                  >
                    <div
                      class="w-6 h-6 rounded bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] flex items-center justify-center overflow-hidden"
                    >
                      <img
                        v-if="watermarkThumbnailCache.get(wm.id)"
                        :src="watermarkThumbnailCache.get(wm.id)"
                        :alt="wm.name"
                        class="max-w-full max-h-full object-contain"
                      />
                      <ImageIcon v-else class="w-3 h-3 text-[var(--sidebar-text-muted)]" />
                    </div>
                    <span class="truncate text-[var(--sidebar-text)]">{{ wm.name }}</span>
                  </button>

                  <div v-if="loadingWatermarks" class="px-2.5 py-3 text-xs text-center text-[var(--sidebar-text-muted)]">Loading...</div>

                  <!-- Upload new watermark button -->
                  <button
                    @click="uploadNewWatermark"
                    :disabled="uploadingWatermark"
                    class="w-full text-left px-2.5 py-2 hover:bg-[var(--sidebar-hover)] transition-colors text-xs flex items-center gap-2 border-t border-[var(--sidebar-border)] text-[var(--sidebar-accent)] hover:text-[var(--sidebar-primary)]"
                  >
                    <div
                      class="w-6 h-6 rounded bg-[rgba(6,182,212,0.15)] flex items-center justify-center"
                    >
                      <Upload v-if="!uploadingWatermark" class="w-3 h-3 text-[var(--sidebar-accent)]" />
                      <Loader2 v-else class="w-3 h-3 text-[var(--sidebar-accent)] animate-spin" />
                    </div>
                    <span>{{ uploadingWatermark ? 'Uploading...' : 'Upload new' }}</span>
                  </button>
                </div>
              </div>

              <!-- Full-Frame Overlay Toggle -->
              <label
                class="flex items-center gap-2 px-2.5 py-2 bg-[var(--sidebar-hover)] border border-[var(--sidebar-border)] rounded-lg cursor-pointer hover:border-[var(--sidebar-text-muted)] transition-all flex-shrink-0"
              >
                <input
                  type="checkbox"
                  :checked="fullFrameOverlayRatios[currentAspectRatio]"
                  @change="toggleFullFrameOverlay"
                  class="w-3.5 h-3.5 rounded border-[var(--sidebar-border)] bg-[var(--sidebar-surface)] text-[var(--sidebar-accent)] focus:ring-[var(--sidebar-accent)] focus:ring-offset-[var(--sidebar-surface)]"
                />
                <span class="text-xs text-[var(--sidebar-text)] whitespace-nowrap">Full-frame</span>
              </label>
            </div>

            <!-- Preview Area with dynamic aspect ratio -->
            <div class="flex justify-center mb-3">
              <div
                ref="previewContainer"
                class="relative bg-[var(--sidebar-surface)] rounded-lg overflow-hidden border transition-all duration-300 select-none"
                :class="[
                  enabledRatios[currentAspectRatio]
                    ? 'cursor-crosshair border-[var(--sidebar-border)]'
                    : 'cursor-not-allowed border-[var(--sidebar-border)] opacity-50',
                ]"
                :style="previewContainerStyle"
                @mousedown.prevent="enabledRatios[currentAspectRatio] && startDrag($event)"
                @mousemove="enabledRatios[currentAspectRatio] && handleDrag($event)"
                @mouseup="endDrag"
                @mouseleave="endDrag"
              >
                <!-- Grid lines for guidance -->
                <div class="absolute inset-0 pointer-events-none">
                  <div class="absolute left-1/3 top-0 bottom-0 w-px bg-[var(--sidebar-border)]"></div>
                  <div class="absolute left-2/3 top-0 bottom-0 w-px bg-[var(--sidebar-border)]"></div>
                  <div class="absolute top-1/3 left-0 right-0 h-px bg-[var(--sidebar-border)]"></div>
                  <div class="absolute top-2/3 left-0 right-0 h-px bg-[var(--sidebar-border)]"></div>
                </div>

                <!-- Aspect ratio label -->
                <div class="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 rounded text-[10px] text-white/70 z-10">
                  {{ currentAspectRatioLabel }}
                </div>

                <!-- Sample video content indicator -->
                <div class="absolute inset-0 flex items-center justify-center text-[var(--sidebar-text-muted)]">
                  <Video class="w-8 h-8 opacity-20" />
                </div>

                <!-- Loading indicator -->
                <div v-if="loadingWatermark" class="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                  <div class="text-[var(--sidebar-accent)] text-xs">Loading...</div>
                </div>

                <!-- Watermark preview -->
                <div
                  v-if="watermarkDataUrl && enabledRatios[currentAspectRatio]"
                  class="absolute group"
                  :class="{
                    'pointer-events-none': !enabledRatios[currentAspectRatio],
                    'transition-all duration-75': !watermarkResizeState.isResizing && !justFinishedResize
                  }"
                  :style="watermarkStyle"
                >
                  <img
                    :src="watermarkDataUrl"
                    :class="[
                      'drop-shadow-lg select-none',
                      fullFrameOverlayRatios[currentAspectRatio] || isFullFrameWatermark
                        ? 'w-full h-full object-cover'
                        : 'max-w-full max-h-full object-contain',
                    ]"
                    :style="{ opacity: currentSettings.opacity / 100 }"
                    draggable="false"
                    @dragstart.prevent
                    @error="handleImageError"
                  />
                  <!-- Resize Handles -->
                  <div
                    v-if="!fullFrameOverlayRatios[currentAspectRatio] && enabledRatios[currentAspectRatio]"
                    class="absolute inset-0 pointer-events-none"
                  >
                    <!-- Top Left -->
                    <div
                      class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-[var(--sidebar-accent)] rounded-full cursor-nwse-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startWatermarkResize($event, 'tl')"
                    ></div>
                    <!-- Top Right -->
                    <div
                      class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-[var(--sidebar-accent)] rounded-full cursor-nesw-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startWatermarkResize($event, 'tr')"
                    ></div>
                    <!-- Bottom Left -->
                    <div
                      class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-[var(--sidebar-accent)] rounded-full cursor-nesw-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startWatermarkResize($event, 'bl')"
                    ></div>
                    <!-- Bottom Right -->
                    <div
                      class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-[var(--sidebar-accent)] rounded-full cursor-nwse-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startWatermarkResize($event, 'br')"
                    ></div>
                    <!-- Border on hover -->
                    <div class="absolute inset-0 border border-[var(--sidebar-accent)] opacity-0 group-hover:opacity-40 pointer-events-none"></div>
                  </div>
                </div>

                <!-- Disabled overlay -->
                <div
                  v-if="!enabledRatios[currentAspectRatio]"
                  class="absolute inset-0 flex items-center justify-center bg-black/10 backdrop-blur-[1px]"
                >
                  <span class="text-[var(--sidebar-text-muted)] text-xs">Disabled</span>
                </div>

                <!-- Position indicator -->
                <div
                  v-if="enabledRatios[currentAspectRatio] && !fullFrameOverlayRatios[currentAspectRatio]"
                  class="absolute w-2.5 h-2.5 bg-[var(--sidebar-accent)] rounded-full border-2 border-white shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                  :style="{ left: `${currentSettings.x}%`, top: `${currentSettings.y}%` }"
                ></div>
              </div>
            </div>

            <!-- Controls Row -->
            <div :class="{ 'opacity-50 pointer-events-none': !enabledRatios[currentAspectRatio] }">
              <div class="flex items-center gap-6 flex-wrap">
                <!-- Quick positions -->
                <div
                  class="flex items-center gap-1.5"
                  :class="{ 'opacity-50 pointer-events-none': fullFrameOverlayRatios[currentAspectRatio] }"
                >
                  <span class="text-[10px] text-[var(--sidebar-text-muted)] mr-1">Position:</span>
                  <div class="flex items-center gap-1">
                    <button
                      v-for="preset in presets"
                      :key="preset.name"
                      @click="applyPreset(preset)"
                      :disabled="!enabledRatios[currentAspectRatio] || fullFrameOverlayRatios[currentAspectRatio]"
                      class="px-2 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap"
                      :class="
                        isPresetActive(preset)
                          ? 'bg-[rgba(6,182,212,0.15)] text-[var(--sidebar-accent)]'
                          : 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]'
                      "
                    >
                      {{ preset.name }}
                    </button>
                  </div>
                </div>

                <!-- Opacity Slider -->
                <div class="flex items-center gap-2 flex-1 min-w-[200px] max-w-[280px]">
                  <label class="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap">Opacity</label>
                  <input
                    type="range"
                    :value="currentSettings.opacity"
                    @input="updateOpacity(Number(($event.target as HTMLInputElement).value))"
                    min="10"
                    max="100"
                    :disabled="!enabledRatios[currentAspectRatio]"
                    class="flex-1 h-1 bg-[var(--sidebar-border)] rounded-lg appearance-none cursor-pointer accent-[var(--sidebar-accent)]"
                  />
                  <span class="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap min-w-[32px] text-right">{{ currentSettings.opacity }}%</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Footer -->
          <div
            class="flex items-center justify-end gap-2 px-4 py-3 border-t border-[var(--sidebar-border)] flex-shrink-0"
          >
            <button
              @click="$emit('close')"
              class="px-4 py-2 bg-[var(--sidebar-hover)] hover:bg-[var(--sidebar-active)] text-[var(--sidebar-text)] hover:text-[var(--sidebar-text)] rounded-lg transition-all text-sm font-medium border border-[var(--sidebar-border)]"
            >
              Cancel
            </button>
            <button
              @click="savePosition"
              class="px-4 py-2 bg-gradient-to-br from-[var(--sidebar-accent)] to-[#0891b2] hover:opacity-90 text-white rounded-lg font-medium transition-all text-sm"
            >
              Save
            </button>
          </div>
        </div>
      </Transition>
    </div>
  </Transition>
  </Teleport>
</template>

<script setup lang="ts">
  import { ref, computed, watch, reactive, onUnmounted } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import {
    X,
    Move,
    Video,
    Monitor,
    Smartphone,
    Square,
    RectangleVertical,
    ChevronDown,
    Image as ImageIcon,
    Upload,
    Loader2,
  } from 'lucide-vue-next';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';

  // Types for watermark settings per aspect ratio
  export type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';

  export interface CreatorWatermarkPosition {
    x: number;
    y: number;
    opacity: number;
    scale: number;
    isFullFrameOverlay?: boolean; // When true, position at 0,0 with 100% scale (full-frame overlay)
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
    watermarkFilePath?: string; // Default watermark file path (local)
    watermarkUrl?: string; // Default watermark URL (remote, e.g., for organization assets)
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

  const defaultPosition: CreatorWatermarkPosition = { x: 12, y: 92, opacity: 80, scale: 20, isFullFrameOverlay: false };

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
  const dragStartPos = ref<{ x: number; y: number } | null>(null);
  const hasDragged = ref(false);
  const justFinishedResize = ref(false);
  const watermarkDataUrl = ref<string | null>(null);
  const loadingWatermark = ref(false);
  const measuredWidth = ref<number | null>(null);
  const measuredHeight = ref<number | null>(null);
  const currentAspectRatio = ref<AspectRatioId>('16:9');
  const isFullFrameWatermark = computed(() => {
    // If current ratio has its own watermark selected, use measured dimensions
    // Otherwise fall back to default watermark props
    const hasRatioSpecificWatermark = !!ratioWatermarkIds[currentAspectRatio.value];

    const w = hasRatioSpecificWatermark ? measuredWidth.value : (props.watermarkWidth ?? measuredWidth.value);
    const h = hasRatioSpecificWatermark ? measuredHeight.value : (props.watermarkHeight ?? measuredHeight.value);

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

  // Track which ratios use full-frame overlay mode (position 0,0 with 100% scale)
  const fullFrameOverlayRatios = reactive<Record<AspectRatioId, boolean>>({
    '16:9': false,
    '9:16': false,
    '1:1': false,
    '4:5': false,
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
  const anyRatioEnabled = computed(() => Object.values(enabledRatios).some((v) => v));

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
    if (!ar) return { width: '420px', aspectRatio: '16/9' };

    // Calculate size to fit nicely in the container
    const maxWidth =
      currentAspectRatio.value === '16:9'
        ? '440px'
        : currentAspectRatio.value === '9:16'
          ? '200px'
          : currentAspectRatio.value === '1:1'
            ? '280px'
            : '220px';

    return {
      width: maxWidth,
      aspectRatio: `${ar.width}/${ar.height}`,
    };
  });

  // Computed watermark style
  const watermarkStyle = computed(() => {
    const settings = currentSettings.value;
    const isFullFrame = fullFrameOverlayRatios[currentAspectRatio.value];

    // Full-frame overlay mode: position at 0,0 with 100% scale
    // Also applies to 1920x1080 canvases for backward compatibility
    if (isFullFrame || isFullFrameWatermark.value) {
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
    return watermarks.value.find((w) => w.id === wmId) || null;
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
        const newWatermark = watermarks.value.find((w) => w.id === result.watermarkId);

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
    // Check if we have a local file path or a remote URL
    const hasLocalPath = !!props.watermarkFilePath;
    const hasRemoteUrl = !!props.watermarkUrl;

    if (!hasLocalPath && !hasRemoteUrl) {
      watermarkDataUrl.value = null;
      measuredWidth.value = null;
      measuredHeight.value = null;
      return;
    }

    loadingWatermark.value = true;
    try {
      let imageUrl: string;

      if (hasRemoteUrl) {
        // Use remote URL directly (for organization assets)
        imageUrl = props.watermarkUrl!;
      } else {
        // Load from local file path
        imageUrl = await invoke<string>('read_file_as_data_url', {
          filePath: props.watermarkFilePath,
        });
      }

      watermarkDataUrl.value = imageUrl;

      // Also measure dimensions from the loaded image so we can detect 1920x1080 even if metadata is missing.
      await new Promise<void>((resolve) => {
        const img = new Image();
        img.onload = () => {
          measuredWidth.value = img.naturalWidth || null;
          measuredHeight.value = img.naturalHeight || null;
          resolve();
        };
        img.onerror = () => resolve();
        img.src = imageUrl;
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
              // Load isFullFrameOverlay from position settings
              fullFrameOverlayRatios[id] = incomingConfig.position.isFullFrameOverlay ?? false;
            } else if (
              'x' in incomingConfig &&
              'y' in incomingConfig &&
              'opacity' in incomingConfig &&
              'scale' in incomingConfig
            ) {
              // Old format - just position values (has x, y, opacity, scale properties directly)
              const oldConfig = incomingConfig as {
                x: number;
                y: number;
                opacity: number;
                scale: number;
                isFullFrameOverlay?: boolean;
              };
              localSettings[id] = {
                x: oldConfig.x,
                y: oldConfig.y,
                opacity: oldConfig.opacity,
                scale: oldConfig.scale,
              };
              ratioWatermarkIds[id] = props.watermarkId || null;
              fullFrameOverlayRatios[id] = oldConfig.isFullFrameOverlay ?? false;
            } else {
              localSettings[id] = { ...defaultPosition };
              ratioWatermarkIds[id] = null;
              fullFrameOverlayRatios[id] = false;
            }
          } else {
            // Settings are null - ratio is disabled, but use defaults for UI
            enabledRatios[id] = false;
            localSettings[id] = { ...defaultPosition };
            ratioWatermarkIds[id] = null;
            fullFrameOverlayRatios[id] = false;
          }
        }

        // If default watermark provided, use it for 16:9 if not already set
        if (props.watermarkId && !ratioWatermarkIds['16:9']) {
          ratioWatermarkIds['16:9'] = props.watermarkId;
        }

        // Start on the first enabled ratio, or default to 16:9
        const firstEnabled = aspectRatios.find((ar) => enabledRatios[ar.id]);
        currentAspectRatio.value = firstEnabled?.id || '16:9';

        await loadWatermarkImageForRatio();
      }
    }
  );

  // Reload watermark if file path or URL changes
  watch(
    () => [props.watermarkFilePath, props.watermarkUrl],
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

  // Toggle full-frame overlay mode for current ratio
  // When enabled, sets position to 0,0 and scale to 100% as presets (user can still adjust)
  function toggleFullFrameOverlay() {
    const ratio = currentAspectRatio.value;
    const newValue = !fullFrameOverlayRatios[ratio];
    fullFrameOverlayRatios[ratio] = newValue;

    // If enabling full-frame overlay, set position to 0,0 and scale to 100% as presets
    if (newValue) {
      localSettings[ratio].x = 0;
      localSettings[ratio].y = 0;
      localSettings[ratio].scale = 100;
    }
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

  // State for watermark resizing
  const watermarkResizeState = reactive<{
    isResizing: boolean;
    handle: 'tl' | 'tr' | 'bl' | 'br' | null;
    anchorX: number;
    anchorY: number;
    startWidth: number;
    startHeight: number;
    startScale: number;
    startPosition: { x: number; y: number };
    containerRect: DOMRect | null;
  }>({
    isResizing: false,
    handle: null,
    anchorX: 0,
    anchorY: 0,
    startWidth: 0,
    startHeight: 0,
    startScale: 0,
    startPosition: { x: 0, y: 0 },
    containerRect: null,
  });

  function startWatermarkResize(e: MouseEvent, handle: 'tl' | 'tr' | 'bl' | 'br') {
    e.preventDefault();
    e.stopPropagation();

    if (!previewContainer.value) return;

    // Get the watermark element (the parent of the handle)
    const watermarkWrapper = (e.target as HTMLElement).closest('.group');
    if (!watermarkWrapper) return;

    const rect = watermarkWrapper.getBoundingClientRect();
    const containerRect = previewContainer.value.getBoundingClientRect();
    const settings = currentSettings.value;

    // Calculate anchor corner (opposite to the handle being dragged)
    let anchorX: number, anchorY: number;
    switch (handle) {
      case 'tl': // Dragging top-left, anchor is bottom-right
        anchorX = rect.right;
        anchorY = rect.bottom;
        break;
      case 'tr': // Dragging top-right, anchor is bottom-left
        anchorX = rect.left;
        anchorY = rect.bottom;
        break;
      case 'bl': // Dragging bottom-left, anchor is top-right
        anchorX = rect.right;
        anchorY = rect.top;
        break;
      case 'br': // Dragging bottom-right, anchor is top-left
      default:
        anchorX = rect.left;
        anchorY = rect.top;
        break;
    }

    watermarkResizeState.isResizing = true;
    watermarkResizeState.handle = handle;
    watermarkResizeState.anchorX = anchorX;
    watermarkResizeState.anchorY = anchorY;
    watermarkResizeState.startWidth = rect.width;
    watermarkResizeState.startHeight = rect.height;
    watermarkResizeState.startScale = settings.scale;
    watermarkResizeState.startPosition = { x: settings.x, y: settings.y };
    watermarkResizeState.containerRect = containerRect;

    document.addEventListener('mousemove', onWatermarkResizeMove);
    document.addEventListener('mouseup', onWatermarkResizeEnd);
  }

  function onWatermarkResizeMove(e: MouseEvent) {
    if (!watermarkResizeState.isResizing || !watermarkResizeState.containerRect) return;

    const { handle, anchorX, anchorY, startWidth, startHeight, startScale, containerRect } = watermarkResizeState;

    // Calculate new width based on distance from anchor to mouse
    let newWidth: number, newHeight: number;

    switch (handle) {
      case 'tl':
        newWidth = anchorX - e.clientX;
        newHeight = anchorY - e.clientY;
        break;
      case 'tr':
        newWidth = e.clientX - anchorX;
        newHeight = anchorY - e.clientY;
        break;
      case 'bl':
        newWidth = anchorX - e.clientX;
        newHeight = e.clientY - anchorY;
        break;
      case 'br':
      default:
        newWidth = e.clientX - anchorX;
        newHeight = e.clientY - anchorY;
        break;
    }

    // Maintain aspect ratio - use the larger dimension change
    const widthRatio = Math.abs(newWidth) / startWidth;
    const heightRatio = Math.abs(newHeight) / startHeight;
    const scaleRatio = Math.max(widthRatio, heightRatio, 0.1);

    let newScale = startScale * scaleRatio;
    // Enforce limits (5% to 100% based on slider limits)
    newScale = Math.max(5, Math.min(100, newScale));

    // Calculate actual new dimensions based on the clamped scale
    // We need to re-calculate the ratio because we clamped the scale
    const effectiveRatio = newScale / startScale;
    const actualNewWidth = startWidth * effectiveRatio;
    const actualNewHeight = startHeight * effectiveRatio;

    // Calculate new center position based on anchor and new dimensions
    let newCenterX: number, newCenterY: number;

    switch (handle) {
      case 'tl': // Anchor is bottom-right
        newCenterX = anchorX - actualNewWidth / 2;
        newCenterY = anchorY - actualNewHeight / 2;
        break;
      case 'tr': // Anchor is bottom-left
        newCenterX = anchorX + actualNewWidth / 2;
        newCenterY = anchorY - actualNewHeight / 2;
        break;
      case 'bl': // Anchor is top-right
        newCenterX = anchorX - actualNewWidth / 2;
        newCenterY = anchorY + actualNewHeight / 2;
        break;
      case 'br': // Anchor is top-left
      default:
        newCenterX = anchorX + actualNewWidth / 2;
        newCenterY = anchorY + actualNewHeight / 2;
        break;
    }

    // Convert center position to percentage relative to container
    const newX = ((newCenterX - containerRect.left) / containerRect.width) * 100;
    const newY = ((newCenterY - containerRect.top) / containerRect.height) * 100;

    // Update settings with precise values (rounding happens on resize end)
    localSettings[currentAspectRatio.value].scale = newScale;
    localSettings[currentAspectRatio.value].x = newX;
    localSettings[currentAspectRatio.value].y = newY;
  }

  function onWatermarkResizeEnd() {
    // Round values only when resize completes
    const ratio = currentAspectRatio.value;
    localSettings[ratio].scale = Math.round(localSettings[ratio].scale);
    localSettings[ratio].x = Math.round(localSettings[ratio].x);
    localSettings[ratio].y = Math.round(localSettings[ratio].y);

    // Set flag to prevent transitions from animating the rounding difference
    justFinishedResize.value = true;

    watermarkResizeState.isResizing = false;
    watermarkResizeState.handle = null;
    watermarkResizeState.containerRect = null;

    document.removeEventListener('mousemove', onWatermarkResizeMove);
    document.removeEventListener('mouseup', onWatermarkResizeEnd);

    // Clear the flag after a frame so transitions can resume
    requestAnimationFrame(() => {
      justFinishedResize.value = false;
    });
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onWatermarkResizeMove);
    document.removeEventListener('mouseup', onWatermarkResizeEnd);
  });

  function startDrag(event: MouseEvent) {
    if (watermarkResizeState.isResizing) return;
    if (justFinishedResize.value) return; // Prevent accidental drag right after resize
    isDragging.value = true;
    hasDragged.value = false;
    dragStartPos.value = { x: event.clientX, y: event.clientY };
  }

  function handleDrag(event: MouseEvent) {
    if (watermarkResizeState.isResizing) return;
    if (!isDragging.value || !dragStartPos.value) return;

    // Require minimum 3px movement to start actual drag
    const dx = event.clientX - dragStartPos.value.x;
    const dy = event.clientY - dragStartPos.value.y;
    if (!hasDragged.value && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

    hasDragged.value = true;
    updatePositionFromEvent(event);
  }

  function endDrag() {
    isDragging.value = false;
    dragStartPos.value = null;
    // hasDragged resets on next startDrag
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
    // Include watermarkId, position, and isFullFrameOverlay for each enabled ratio
    const buildRatioSettings = (ratio: AspectRatioId) => {
      if (!enabledRatios[ratio]) return null;
      return {
        watermarkId: ratioWatermarkIds[ratio],
        position: {
          ...localSettings[ratio],
          isFullFrameOverlay: fullFrameOverlayRatios[ratio],
        },
      };
    };

    emit('save', {
      '16:9': buildRatioSettings('16:9'),
      '9:16': buildRatioSettings('9:16'),
      '1:1': buildRatioSettings('1:1'),
      '4:5': buildRatioSettings('4:5'),
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
    background: var(--sidebar-accent);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }

  input[type='range']::-moz-range-thumb {
    width: 16px;
    height: 16px;
    border-radius: 50%;
    background: var(--sidebar-accent);
    cursor: pointer;
    border: 2px solid white;
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
  }
</style>
