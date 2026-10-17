<template>
  <Modal
    :open="show"
    title="Watermark position"
    description="Place the watermark for each output aspect ratio."
    :icon="Move"
    size="xl"
    @close="$emit('close')"
  >
    <!-- Ratio + enable -->
    <div class="mb-3 flex flex-wrap items-center gap-3">
      <RatioTabs
        :model-value="currentAspectRatio"
        :options="aspectRatios"
        :marked="enabledRatios"
        @update:model-value="selectAspectRatio"
      />
      <label class="ml-auto flex items-center gap-2 text-xs text-fg-muted" :class="{ 'opacity-50': readOnly }">
        {{ enabledRatios[currentAspectRatio] ? 'Enabled' : 'Disabled' }}
        <Switch
          :model-value="enabledRatios[currentAspectRatio]"
          :disabled="readOnly"
          @update:model-value="!readOnly && toggleCurrentRatio()"
        />
      </label>
    </div>

    <!-- Watermark selection + full-frame -->
    <div v-if="enabledRatios[currentAspectRatio]" class="mb-3 flex items-center gap-2">
      <DropdownMenu
        :open="showWatermarkDropdown"
        @update:open="(open: boolean) => (showWatermarkDropdown = !readOnly && open)"
      >
        <DropdownMenuTrigger as-child :disabled="readOnly">
          <button
            type="button"
            class="flex h-[var(--control-md)] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised pl-1 pr-2.5 text-left text-sm text-fg transition-colors hover:border-line-strong disabled:opacity-50 data-[state=open]:border-line-strong"
          >
            <span
              class="transparency-checkerboard grid size-6 shrink-0 place-items-center overflow-hidden rounded border border-line-subtle"
            >
              <img
                v-if="currentRatioWatermarkUrl"
                :src="currentRatioWatermarkUrl"
                :alt="currentRatioWatermark?.name || 'Default'"
                class="max-h-full max-w-full object-contain"
              />
              <ImageIcon v-else class="size-3 text-fg-muted" />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ currentRatioWatermark?.name || 'Default watermark' }}</span>
            <ChevronDown class="size-3.5 shrink-0 text-fg-subtle" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto">
          <DropdownMenuItem @select="selectWatermarkForRatio(null)">
            <span class="grid size-6 shrink-0 place-items-center rounded border border-line-subtle bg-surface-hover">
              <ImageIcon class="size-3 text-fg-muted" />
            </span>
            <span class="flex-1">Default watermark</span>
            <Check v-if="!ratioWatermarkIds[currentAspectRatio]" class="!text-brand" />
          </DropdownMenuItem>
          <DropdownMenuItem v-for="wm in watermarks" :key="wm.id" @select="selectWatermarkForRatio(wm)">
            <span
              class="transparency-checkerboard grid size-6 shrink-0 place-items-center overflow-hidden rounded border border-line-subtle"
            >
              <img
                v-if="watermarkThumbnailCache.get(wm.id)"
                :src="watermarkThumbnailCache.get(wm.id)"
                :alt="wm.name"
                class="max-h-full max-w-full object-contain"
              />
              <ImageIcon v-else class="size-3 text-fg-muted" />
            </span>
            <span class="min-w-0 flex-1 truncate">{{ wm.name }}</span>
            <Check v-if="ratioWatermarkIds[currentAspectRatio] === wm.id" class="!text-brand" />
          </DropdownMenuItem>
          <div v-if="loadingWatermarks" class="skeleton-group px-2 py-2 text-center text-xs text-fg-muted">
            Loading…
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem :disabled="uploadingWatermark" @select="uploadNewWatermark">
            <Loader2 v-if="uploadingWatermark" class="animate-spin" />
            <Upload v-else />
            {{ uploadingWatermark ? 'Uploading…' : 'Upload new' }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <label
        class="flex h-[var(--control-md)] shrink-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-xs text-fg"
        :class="readOnly ? 'cursor-not-allowed opacity-50' : 'cursor-pointer hover:border-line-strong'"
      >
        <Checkbox
          :model-value="fullFrameOverlayRatios[currentAspectRatio]"
          :disabled="readOnly"
          @update:model-value="toggleFullFrameOverlay()"
        />
        Full-frame
      </label>
    </div>

    <!-- Preview -->
    <div class="mb-4 flex justify-center rounded-lg border border-line-subtle bg-surface-sunken p-4">
      <div
        ref="previewContainer"
        class="transparency-checkerboard relative select-none overflow-hidden rounded-md border border-line transition-all duration-300"
        :class="enabledRatios[currentAspectRatio] ? 'cursor-crosshair' : 'cursor-not-allowed opacity-50'"
        :style="previewContainerStyle"
        @mousedown.prevent="!readOnly && enabledRatios[currentAspectRatio] && startDrag($event)"
        @mousemove="!readOnly && enabledRatios[currentAspectRatio] && handleDrag($event)"
        @mouseup="endDrag"
        @mouseleave="endDrag"
      >
        <!-- Rule-of-thirds guides -->
        <div class="pointer-events-none absolute inset-0">
          <div class="absolute bottom-0 left-1/3 top-0 w-px bg-white/10"></div>
          <div class="absolute bottom-0 left-2/3 top-0 w-px bg-white/10"></div>
          <div class="absolute left-0 right-0 top-1/3 h-px bg-white/10"></div>
          <div class="absolute left-0 right-0 top-2/3 h-px bg-white/10"></div>
        </div>

        <div class="absolute left-1.5 top-1.5 z-10 rounded bg-black/60 px-1.5 py-0.5 text-2xs text-white/80">
          {{ currentAspectRatioLabel }}
        </div>

        <div class="absolute inset-0 flex items-center justify-center text-fg-muted">
          <Video class="size-8 opacity-20" />
        </div>

        <div v-if="loadingWatermark" class="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <Loader2 class="size-4 animate-spin text-fg-muted" />
        </div>

        <!-- Overlays preview (rendered behind watermark) -->
        <template v-if="overlays && overlays.length > 0">
          <div
            v-for="ovl in overlays"
            v-show="ovl.perRatioSettings?.[currentAspectRatio]"
            :key="ovl.id"
            class="pointer-events-none absolute"
            :style="getOverlayStyle(ovl)"
          >
            <MediaPreview
              :src="overlayPreviews?.[ovl.id] || ''"
              class-name="drop-shadow-lg select-none max-w-full max-h-full object-contain"
              :style="{ opacity: (ovl.perRatioSettings?.[currentAspectRatio]?.opacity ?? 100) / 100 }"
            />
          </div>
        </template>

        <!-- Watermark preview -->
        <div
          v-if="watermarkDataUrl && enabledRatios[currentAspectRatio]"
          class="group absolute"
          :class="{
            'pointer-events-none': !enabledRatios[currentAspectRatio],
            'transition-all duration-75': !watermarkResizeState.isResizing && !justFinishedResize,
          }"
          :style="watermarkStyle"
        >
          <MediaPreview
            :src="watermarkDataUrl"
            :class-name="[
              'drop-shadow-lg select-none',
              fullFrameOverlayRatios[currentAspectRatio] || isFullFrameWatermark
                ? 'w-full h-full object-cover'
                : 'max-w-full max-h-full object-contain',
            ]"
            :style="{ opacity: currentSettings.opacity / 100 }"
            @error="handleImageError"
          />
          <!-- Resize handles -->
          <div
            v-if="!readOnly && !fullFrameOverlayRatios[currentAspectRatio] && enabledRatios[currentAspectRatio]"
            class="pointer-events-none absolute inset-0"
          >
            <div
              v-for="corner in resizeCorners"
              :key="corner.id"
              class="pointer-events-auto absolute size-3 rounded-full border border-brand bg-white opacity-0 transition-opacity group-hover:opacity-100"
              :class="corner.class"
              @mousedown.stop.prevent="startWatermarkResize($event, corner.id)"
            ></div>
            <div
              class="pointer-events-none absolute inset-0 border border-brand opacity-0 group-hover:opacity-40"
            ></div>
          </div>
        </div>

        <div
          v-if="!enabledRatios[currentAspectRatio]"
          class="absolute inset-0 flex items-center justify-center bg-black/20"
        >
          <span class="text-xs text-fg-muted">Disabled</span>
        </div>

        <!-- Position indicator -->
        <div
          v-if="enabledRatios[currentAspectRatio] && !fullFrameOverlayRatios[currentAspectRatio]"
          class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-lg transition-all duration-75"
          :style="{ left: `${currentSettings.x}%`, top: `${currentSettings.y}%` }"
        ></div>
      </div>
    </div>

    <!-- Controls -->
    <div
      class="flex flex-col gap-3"
      :class="{ 'pointer-events-none opacity-50': !enabledRatios[currentAspectRatio] || readOnly }"
    >
      <div
        class="flex flex-wrap items-center gap-1.5"
        :class="{ 'pointer-events-none opacity-50': fullFrameOverlayRatios[currentAspectRatio] }"
      >
        <span class="w-14 shrink-0 text-xs text-fg-muted">Position</span>
        <Button
          v-for="preset in presets"
          :key="preset.name"
          size="xs"
          :variant="isPresetActive(preset) ? 'secondary' : 'ghost'"
          :class="isPresetActive(preset) && 'border-brand-line text-brand'"
          :disabled="!enabledRatios[currentAspectRatio] || fullFrameOverlayRatios[currentAspectRatio]"
          @click="applyPreset(preset)"
        >
          {{ preset.name }}
        </Button>
      </div>
      <RangeField
        label="Opacity"
        :model-value="currentSettings.opacity"
        :min="10"
        :max="100"
        :disabled="!enabledRatios[currentAspectRatio]"
        class="max-w-sm"
        @update:model-value="updateOpacity"
      />
    </div>

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">Cancel</Button>
      <Button v-if="!readOnly" variant="primary" @click="savePosition">Save</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  defineOptions({ inheritAttrs: false });
  import { ref, computed, watch, reactive, onUnmounted } from 'vue';
  import { invoke } from '@/services/creatorProfileRuntime';
  import {
    X,
    Move,
    Video,
    Monitor,
    Smartphone,
    Square,
    RectangleVertical,
    ChevronDown,
    Check,
    Image as ImageIcon,
    Upload,
    Loader2,
  } from 'lucide-vue-next';
  import RatioTabs from '@/components/branding/RatioTabs.vue';
  import RangeField from '@/components/branding/RangeField.vue';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Modal } from '@/components/ui/modal';
  import { Switch } from '@/components/ui/switch';
  import { getAllWatermarkImages, useWatermarkOperations } from '@/services/creatorProfileRuntime';
  import { type WatermarkImage } from '@/services/database/types';
  import MediaPreview from '@/components/MediaPreview.vue';

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

  interface OrgAsset {
    id: number;
    name: string;
    url: string;
    asset_type: string;
    width?: number | null;
    height?: number | null;
  }

  interface Props {
    show: boolean;
    watermarkFilePath?: string; // Default watermark file path (local)
    watermarkUrl?: string; // Default watermark URL (remote, e.g., for organization assets)
    watermarkId?: string | null; // Default watermark ID
    watermarkWidth?: number | null;
    watermarkHeight?: number | null;
    settings?: CreatorWatermarkSettings;
    readOnly?: boolean;
    overlays?: Array<any>; // Layout overlays to render in background
    overlayPreviews?: Record<string, string>; // Overlay preview URLs
    orgAssets?: OrgAsset[]; // Organization assets for watermark selection
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

  const resizeCorners = [
    { id: 'tl', class: '-left-1.5 -top-1.5 cursor-nwse-resize' },
    { id: 'tr', class: '-right-1.5 -top-1.5 cursor-nesw-resize' },
    { id: 'bl', class: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
    { id: 'br', class: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
  ] as const;

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

  // Computed overlay style for rendering overlays in watermark picker
  function getOverlayStyle(overlay: any) {
    const ratioSettings = overlay.perRatioSettings?.[currentAspectRatio.value];
    if (!ratioSettings) return { display: 'none' };

    const isFullFrame = ratioSettings.isFullFrameOverlay;

    if (isFullFrame) {
      return {
        left: '0%',
        top: '0%',
        transform: 'none',
        width: '100%',
        height: '100%',
      };
    }

    return {
      left: `${ratioSettings.x}%`,
      top: `${ratioSettings.y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${ratioSettings.scale}%`,
      height: 'auto',
    };
  }

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
      // If orgAssets provided, use organization watermarks
      if (props.orgAssets && props.orgAssets.length > 0) {
        // Convert org assets to WatermarkImage format
        watermarks.value = props.orgAssets
          .filter((asset) => asset.asset_type === 'watermark')
          .map((asset) => ({
            id: String(asset.id),
            name: asset.name,
            file_path: asset.url, // Store URL in file_path for org assets
            width: asset.width || null,
            height: asset.height || null,
            file_size: null,
            created_at: Date.now(),
            updated_at: Date.now(),
            organization_id: null,
            organization_name: null,
            server_id: asset.id,
            sync_status: 'synced' as const,
          }));

        // Load thumbnails for org watermarks (use file_path which contains URL)
        for (const wm of watermarks.value) {
          if (wm.file_path) {
            watermarkThumbnailCache.value.set(wm.id, wm.file_path);
          }
        }
      } else {
        // Use local watermarks
        watermarks.value = await getAllWatermarkImages();
        // Load thumbnails for all watermarks
        for (const wm of watermarks.value) {
          await loadWatermarkThumbnail(wm);
        }
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
        // Check if this is an org asset (URL in file_path) or local file
        if (wm.file_path.startsWith('http')) {
          // Org asset - download through Tauri to bypass CORS
          dataUrl = await invoke<string>('download_url_as_data_url', { url: wm.file_path });
        } else {
          // Local file
          dataUrl = await invoke<string>('read_file_as_data_url', {
            filePath: wm.file_path,
          });
        }
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
