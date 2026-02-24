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
          <div class="h-[3px] w-full flex-shrink-0 bg-gradient-to-r from-amber-500 to-orange-400/50"></div>
          <!-- Header -->
          <div
            class="flex items-center justify-between px-4 py-3 border-b border-[var(--sidebar-border)] flex-shrink-0"
          >
            <div class="flex items-center gap-2.5">
              <div
                class="w-8 h-8 rounded-lg bg-amber-500/15 flex items-center justify-center"
              >
                <Move class="h-4 w-4 text-amber-400" />
              </div>
              <div>
                <h2 class="text-base font-semibold text-[var(--sidebar-text)]">Overlay Position</h2>
                <p v-if="overlayLabel" class="text-[10px] text-[var(--sidebar-text-muted)]">{{ overlayLabel }}</p>
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
                    ? 'bg-amber-500/15 text-amber-400 border border-amber-500/20'
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
                  :class="enabledRatios[currentAspectRatio] ? 'bg-amber-500' : 'bg-[var(--sidebar-hover)]'"
                >
                  <span
                    class="absolute top-0.5 left-0.5 w-3.5 h-3.5 bg-white rounded-full shadow transition-transform"
                    :class="enabledRatios[currentAspectRatio] ? 'translate-x-[18px]' : 'translate-x-0'"
                  ></span>
                </button>
              </div>
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
                <div v-if="loadingOverlay" class="absolute inset-0 flex items-center justify-center bg-black/30 z-20">
                  <div class="text-amber-400 text-xs">Loading...</div>
                </div>

                <!-- Overlay preview -->
                <div
                  v-if="overlayDataUrl && enabledRatios[currentAspectRatio]"
                  class="absolute group"
                  :class="{
                    'pointer-events-none': !enabledRatios[currentAspectRatio],
                    'transition-all duration-75': !resizeState.isResizing && !justFinishedResize
                  }"
                  :style="overlayStyle"
                >
                  <MediaPreview
                    :src="overlayDataUrl"
                    :class-name="[
                      'drop-shadow-lg select-none',
                      fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay
                        ? 'w-full h-full object-cover'
                        : 'max-w-full max-h-full object-contain',
                    ]"
                    :style="{ opacity: currentSettings.opacity / 100 }"
                    @error="handleImageError"
                  />
                  <!-- Resize Handles -->
                  <div
                    v-if="!fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay && enabledRatios[currentAspectRatio]"
                    class="absolute inset-0 pointer-events-none"
                  >
                    <!-- Top Left -->
                    <div
                      class="absolute -top-1.5 -left-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nwse-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startResize($event, 'tl')"
                    ></div>
                    <!-- Top Right -->
                    <div
                      class="absolute -top-1.5 -right-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nesw-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startResize($event, 'tr')"
                    ></div>
                    <!-- Bottom Left -->
                    <div
                      class="absolute -bottom-1.5 -left-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nesw-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startResize($event, 'bl')"
                    ></div>
                    <!-- Bottom Right -->
                    <div
                      class="absolute -bottom-1.5 -right-1.5 w-3 h-3 bg-white border border-amber-500 rounded-full cursor-nwse-resize pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity"
                      @mousedown.stop.prevent="startResize($event, 'br')"
                    ></div>
                    <!-- Border on hover -->
                    <div class="absolute inset-0 border border-amber-500 opacity-0 group-hover:opacity-40 pointer-events-none"></div>
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
                  v-if="enabledRatios[currentAspectRatio] && !fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay"
                  class="absolute w-2.5 h-2.5 bg-amber-500 rounded-full border-2 border-white shadow-lg pointer-events-none transform -translate-x-1/2 -translate-y-1/2 transition-all duration-75"
                  :style="{ left: `${currentSettings.x}%`, top: `${currentSettings.y}%` }"
                ></div>
              </div>
            </div>

            <!-- Full-frame overlay toggle -->
            <div v-if="enabledRatios[currentAspectRatio]" class="flex items-center gap-2 mb-3">
              <label class="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  :checked="fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay"
                  @change="toggleFullFrame"
                  :disabled="isFullFrameOverlay"
                  class="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500 w-3.5 h-3.5"
                />
                <span class="text-[10px] text-[var(--sidebar-text-muted)]">
                  Full-frame overlay
                  <span v-if="isFullFrameOverlay" class="text-amber-400">(auto-detected 1920×1080)</span>
                </span>
              </label>
            </div>

            <!-- Controls Row -->
            <div :class="{ 'opacity-50 pointer-events-none': !enabledRatios[currentAspectRatio] || fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay }">
              <div class="flex items-center gap-6 flex-wrap">
                <!-- Quick positions -->
                <div class="flex items-center gap-1.5">
                  <span class="text-[10px] text-[var(--sidebar-text-muted)] mr-1">Position:</span>
                  <div class="flex items-center gap-1">
                    <button
                      v-for="preset in presets"
                      :key="preset.name"
                      @click="applyPreset(preset)"
                      :disabled="!enabledRatios[currentAspectRatio]"
                      class="px-2 py-1 text-[10px] font-medium rounded transition-all whitespace-nowrap"
                      :class="
                        isPresetActive(preset)
                          ? 'bg-amber-500/15 text-amber-400'
                          : 'bg-[var(--sidebar-hover)] text-[var(--sidebar-text-muted)] hover:text-[var(--sidebar-text)]'
                      "
                    >
                      {{ preset.name }}
                    </button>
                  </div>
                </div>

                <!-- Opacity Slider -->
                <div class="flex items-center gap-2 flex-1 min-w-[160px] max-w-[220px]">
                  <label class="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap">Opacity</label>
                  <input
                    type="range"
                    :value="currentSettings.opacity"
                    @input="updateOpacity(Number(($event.target as HTMLInputElement).value))"
                    min="10"
                    max="100"
                    :disabled="!enabledRatios[currentAspectRatio]"
                    class="flex-1 h-1 bg-[var(--sidebar-border)] rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span class="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap min-w-[32px] text-right">{{ currentSettings.opacity }}%</span>
                </div>

                <!-- Scale Slider -->
                <div class="flex items-center gap-2 flex-1 min-w-[160px] max-w-[220px]">
                  <label class="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap">Scale</label>
                  <input
                    type="range"
                    :value="currentSettings.scale"
                    @input="updateScale(Number(($event.target as HTMLInputElement).value))"
                    min="5"
                    max="100"
                    :disabled="!enabledRatios[currentAspectRatio]"
                    class="flex-1 h-1 bg-[var(--sidebar-border)] rounded-lg appearance-none cursor-pointer accent-amber-500"
                  />
                  <span class="text-[10px] text-[var(--sidebar-text-muted)] whitespace-nowrap min-w-[32px] text-right">{{ currentSettings.scale }}%</span>
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
              class="px-4 py-2 bg-gradient-to-br from-amber-500 to-orange-500 hover:opacity-90 text-white rounded-lg font-medium transition-all text-sm"
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
  } from 'lucide-vue-next';
  import type { OverlayRatioPosition, PerRatioOverlaySettings } from '@/types';
  import MediaPreview from '@/components/MediaPreview.vue';

  type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';

  interface Props {
    show: boolean;
    overlayImagePath: string;
    overlayLabel?: string;
    settings?: PerRatioOverlaySettings | null;
  }

  const props = withDefaults(defineProps<Props>(), {
    overlayLabel: '',
    settings: null,
  });

  const defaultPosition: OverlayRatioPosition = { x: 50, y: 50, width: 100, height: 10, opacity: 100, rotation: 0, scale: 20, isFullFrameOverlay: false };

  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'save', settings: PerRatioOverlaySettings): void;
  }>();

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
  const overlayDataUrl = ref<string | null>(null);
  const loadingOverlay = ref(false);
  const measuredWidth = ref<number | null>(null);
  const measuredHeight = ref<number | null>(null);
  const currentAspectRatio = ref<AspectRatioId>('16:9');

  // Auto-detect full-frame overlay (1920x1080)
  const isFullFrameOverlay = computed(() => {
    return measuredWidth.value === 1920 && measuredHeight.value === 1080;
  });

  // Track which ratios use full-frame overlay mode
  const fullFrameOverlayRatios = reactive<Record<AspectRatioId, boolean>>({
    '16:9': false,
    '9:16': false,
    '1:1': false,
    '4:5': false,
  });

  // Track which aspect ratios have overlay enabled
  const enabledRatios = reactive<Record<AspectRatioId, boolean>>({
    '16:9': true,
    '9:16': false,
    '1:1': false,
    '4:5': false,
  });

  // Local settings for all aspect ratios
  const localSettings = reactive<Record<AspectRatioId, OverlayRatioPosition>>({
    '16:9': { ...defaultPosition },
    '9:16': { ...defaultPosition },
    '1:1': { ...defaultPosition },
    '4:5': { ...defaultPosition },
  });

  // Presets for quick positioning
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

  // Computed overlay style
  const overlayStyle = computed(() => {
    const settings = currentSettings.value;
    const isFullFrame = fullFrameOverlayRatios[currentAspectRatio.value];

    // Full-frame overlay mode: position at 0,0 with 100% scale
    if (isFullFrame || isFullFrameOverlay.value) {
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

  // Load overlay image and measure dimensions
  async function loadOverlayImage() {
    if (!props.overlayImagePath) {
      overlayDataUrl.value = null;
      measuredWidth.value = null;
      measuredHeight.value = null;
      return;
    }

    loadingOverlay.value = true;
    try {
      const dataUrl = await invoke<string>('read_file_as_data_url', {
        filePath: props.overlayImagePath,
      });
      overlayDataUrl.value = dataUrl;

      // Measure image dimensions
      const img = new Image();
      img.onload = () => {
        measuredWidth.value = img.naturalWidth;
        measuredHeight.value = img.naturalHeight;
        console.log(`[OverlayPositionPicker] Image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
      };
      img.src = dataUrl;
    } catch (err) {
      console.error('[OverlayPositionPicker] Failed to load overlay:', err);
      overlayDataUrl.value = null;
      measuredWidth.value = null;
      measuredHeight.value = null;
    } finally {
      loadingOverlay.value = false;
    }
  }

  // Initialize settings when dialog opens
  watch(
    () => props.show,
    async (show) => {
      if (show) {
        // Initialize local settings from props
        const incoming = props.settings;

        for (const ar of aspectRatios) {
          const id = ar.id;
          const incomingConfig = incoming?.[id];

          if (incomingConfig !== null && incomingConfig !== undefined) {
            enabledRatios[id] = true;
            localSettings[id] = { ...defaultPosition, ...incomingConfig };
            fullFrameOverlayRatios[id] = incomingConfig.isFullFrameOverlay ?? false;
          } else {
            enabledRatios[id] = false;
            localSettings[id] = { ...defaultPosition };
            fullFrameOverlayRatios[id] = false;
          }
        }

        // Start on the first enabled ratio, or default to 16:9
        const firstEnabled = aspectRatios.find((ar) => enabledRatios[ar.id]);
        currentAspectRatio.value = firstEnabled?.id || '16:9';

        await loadOverlayImage();
      }
    }
  );

  function selectAspectRatio(id: AspectRatioId) {
    currentAspectRatio.value = id;
  }

  function toggleCurrentRatio() {
    enabledRatios[currentAspectRatio.value] = !enabledRatios[currentAspectRatio.value];
  }

  function updateOpacity(value: number) {
    localSettings[currentAspectRatio.value].opacity = value;
  }

  function updateScale(value: number) {
    localSettings[currentAspectRatio.value].scale = value;
  }

  function toggleFullFrame() {
    if (isFullFrameOverlay.value) return; // Can't toggle if auto-detected
    fullFrameOverlayRatios[currentAspectRatio.value] = !fullFrameOverlayRatios[currentAspectRatio.value];
  }

  // Resize state
  const resizeState = reactive<{
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

  function startResize(e: MouseEvent, handle: 'tl' | 'tr' | 'bl' | 'br') {
    e.preventDefault();
    e.stopPropagation();

    if (!previewContainer.value) return;

    const overlayWrapper = (e.target as HTMLElement).closest('.group');
    if (!overlayWrapper) return;

    const rect = overlayWrapper.getBoundingClientRect();
    const containerRect = previewContainer.value.getBoundingClientRect();
    const settings = currentSettings.value;

    let anchorX: number, anchorY: number;
    switch (handle) {
      case 'tl':
        anchorX = rect.right;
        anchorY = rect.bottom;
        break;
      case 'tr':
        anchorX = rect.left;
        anchorY = rect.bottom;
        break;
      case 'bl':
        anchorX = rect.right;
        anchorY = rect.top;
        break;
      case 'br':
      default:
        anchorX = rect.left;
        anchorY = rect.top;
        break;
    }

    resizeState.isResizing = true;
    resizeState.handle = handle;
    resizeState.anchorX = anchorX;
    resizeState.anchorY = anchorY;
    resizeState.startWidth = rect.width;
    resizeState.startHeight = rect.height;
    resizeState.startScale = settings.scale;
    resizeState.startPosition = { x: settings.x, y: settings.y };
    resizeState.containerRect = containerRect;

    document.addEventListener('mousemove', onResizeMove);
    document.addEventListener('mouseup', onResizeEnd);
  }

  function onResizeMove(e: MouseEvent) {
    if (!resizeState.isResizing || !resizeState.containerRect) return;

    const { handle, anchorX, anchorY, startWidth, startHeight, startScale, containerRect } = resizeState;

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

    const widthRatio = Math.abs(newWidth) / startWidth;
    const heightRatio = Math.abs(newHeight) / startHeight;
    const scaleRatio = Math.max(widthRatio, heightRatio, 0.1);

    let newScale = startScale * scaleRatio;
    newScale = Math.max(5, Math.min(100, newScale));

    const effectiveRatio = newScale / startScale;
    const actualNewWidth = startWidth * effectiveRatio;
    const actualNewHeight = startHeight * effectiveRatio;

    let newCenterX: number, newCenterY: number;

    switch (handle) {
      case 'tl':
        newCenterX = anchorX - actualNewWidth / 2;
        newCenterY = anchorY - actualNewHeight / 2;
        break;
      case 'tr':
        newCenterX = anchorX + actualNewWidth / 2;
        newCenterY = anchorY - actualNewHeight / 2;
        break;
      case 'bl':
        newCenterX = anchorX - actualNewWidth / 2;
        newCenterY = anchorY + actualNewHeight / 2;
        break;
      case 'br':
      default:
        newCenterX = anchorX + actualNewWidth / 2;
        newCenterY = anchorY + actualNewHeight / 2;
        break;
    }

    const newX = ((newCenterX - containerRect.left) / containerRect.width) * 100;
    const newY = ((newCenterY - containerRect.top) / containerRect.height) * 100;

    localSettings[currentAspectRatio.value].scale = newScale;
    localSettings[currentAspectRatio.value].x = newX;
    localSettings[currentAspectRatio.value].y = newY;
  }

  function onResizeEnd() {
    const ratio = currentAspectRatio.value;
    localSettings[ratio].scale = Math.round(localSettings[ratio].scale);
    localSettings[ratio].x = Math.round(localSettings[ratio].x);
    localSettings[ratio].y = Math.round(localSettings[ratio].y);

    justFinishedResize.value = true;

    resizeState.isResizing = false;
    resizeState.handle = null;
    resizeState.containerRect = null;

    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);

    requestAnimationFrame(() => {
      justFinishedResize.value = false;
    });
  }

  onUnmounted(() => {
    document.removeEventListener('mousemove', onResizeMove);
    document.removeEventListener('mouseup', onResizeEnd);
  });

  function startDrag(event: MouseEvent) {
    if (resizeState.isResizing) return;
    if (justFinishedResize.value) return;
    isDragging.value = true;
    hasDragged.value = false;
    dragStartPos.value = { x: event.clientX, y: event.clientY };
  }

  function handleDrag(event: MouseEvent) {
    if (resizeState.isResizing) return;
    if (!isDragging.value || !dragStartPos.value) return;

    const dx = event.clientX - dragStartPos.value.x;
    const dy = event.clientY - dragStartPos.value.y;
    if (!hasDragged.value && Math.abs(dx) < 3 && Math.abs(dy) < 3) return;

    hasDragged.value = true;
    updatePositionFromEvent(event);
  }

  function endDrag() {
    isDragging.value = false;
    dragStartPos.value = null;
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

  function handleImageError(event: Event) {
    const img = event.target as HTMLImageElement;
    img.style.display = 'none';
  }

  function savePosition() {
    const buildRatioSettings = (ratio: AspectRatioId): OverlayRatioPosition | null => {
      if (!enabledRatios[ratio]) return null;
      return {
        ...localSettings[ratio],
        isFullFrameOverlay: fullFrameOverlayRatios[ratio] || isFullFrameOverlay.value,
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
