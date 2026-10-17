<template>
  <Modal
    :open="show"
    title="Overlay position"
    :description="overlayLabel || 'Place the layout overlay for each output aspect ratio.'"
    :icon="Move"
    size="xl"
    @close="$emit('close')"
  >
    <!-- Ratio + upload + enable -->
    <div class="mb-3 flex flex-wrap items-center gap-2">
      <RatioTabs
        :model-value="currentAspectRatio"
        :options="aspectRatios"
        :marked="enabledRatios"
        @update:model-value="selectAspectRatio"
      />
      <Button
        variant="secondary"
        size="sm"
        :loading="uploadingRatioOverlay"
        title="Upload overlay for this aspect ratio"
        @click="uploadOverlayForCurrentRatio"
      >
        <Upload v-if="!uploadingRatioOverlay" />
        {{ uploadingRatioOverlay ? 'Uploading…' : 'Upload' }}
      </Button>
      <label class="ml-auto flex items-center gap-2 text-xs text-fg-muted">
        {{ enabledRatios[currentAspectRatio] ? 'Enabled' : 'Disabled' }}
        <Switch :model-value="enabledRatios[currentAspectRatio]" @update:model-value="toggleCurrentRatio()" />
      </label>
    </div>

    <!-- Preview -->
    <div class="mb-3 flex justify-center rounded-lg border border-line-subtle bg-surface-sunken p-4">
      <div
        ref="previewContainer"
        class="relative select-none overflow-hidden rounded-md border border-line bg-surface transition-all duration-300"
        :class="enabledRatios[currentAspectRatio] ? 'cursor-crosshair' : 'cursor-not-allowed opacity-50'"
        :style="previewContainerStyle"
        @mousedown.prevent="enabledRatios[currentAspectRatio] && startDrag($event)"
        @mousemove="enabledRatios[currentAspectRatio] && handleDrag($event)"
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

        <div v-if="loadingOverlay" class="absolute inset-0 z-20 flex items-center justify-center bg-black/30">
          <Loader2 class="size-4 animate-spin text-fg-muted" />
        </div>

        <!-- Watermark preview (behind the overlay, for reference) -->
        <div
          v-if="watermarkDataUrl && hasWatermarkForCurrentRatio"
          class="pointer-events-none absolute z-[1]"
          :style="watermarkStyle"
        >
          <MediaPreview :src="watermarkDataUrl" class-name="drop-shadow-lg select-none max-w-full max-h-full object-contain" />
        </div>

        <!-- Overlay preview -->
        <div
          v-if="overlayDataUrl && enabledRatios[currentAspectRatio]"
          class="group absolute"
          :class="{
            'pointer-events-none': !enabledRatios[currentAspectRatio],
            'transition-all duration-75': !resizeState.isResizing && !justFinishedResize,
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
          <!-- Resize handles -->
          <div
            v-if="!fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay && enabledRatios[currentAspectRatio]"
            class="pointer-events-none absolute inset-0"
          >
            <div
              v-for="corner in resizeCorners"
              :key="corner.id"
              class="pointer-events-auto absolute size-3 rounded-full border border-brand bg-white opacity-0 transition-opacity group-hover:opacity-100"
              :class="corner.class"
              @mousedown.stop.prevent="startResize($event, corner.id)"
            ></div>
            <div class="pointer-events-none absolute inset-0 border border-brand opacity-0 group-hover:opacity-40"></div>
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
          v-if="enabledRatios[currentAspectRatio] && !fullFrameOverlayRatios[currentAspectRatio] && !isFullFrameOverlay"
          class="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-lg transition-all duration-75"
          :style="{ left: `${currentSettings.x}%`, top: `${currentSettings.y}%` }"
        ></div>
      </div>
    </div>

    <!-- Full-frame toggle -->
    <label v-if="enabledRatios[currentAspectRatio]" class="mb-3 flex cursor-pointer items-center gap-2 text-xs text-fg-muted">
      <Checkbox
        :model-value="fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay"
        :disabled="isFullFrameOverlay"
        @update:model-value="toggleFullFrame()"
      />
      Full-frame overlay
      <span v-if="isFullFrameOverlay" class="text-fg-subtle">(auto-detected 1920×1080)</span>
    </label>

    <!-- Controls -->
    <div
      class="flex flex-col gap-3"
      :class="{
        'pointer-events-none opacity-50':
          !enabledRatios[currentAspectRatio] || fullFrameOverlayRatios[currentAspectRatio] || isFullFrameOverlay,
      }"
    >
      <div class="flex flex-wrap items-center gap-1.5">
        <span class="w-14 shrink-0 text-xs text-fg-muted">Position</span>
        <Button
          v-for="preset in presets"
          :key="preset.name"
          size="xs"
          :variant="isPresetActive(preset) ? 'secondary' : 'ghost'"
          :class="isPresetActive(preset) && 'border-brand-line text-brand'"
          :disabled="!enabledRatios[currentAspectRatio]"
          @click="applyPreset(preset)"
        >
          {{ preset.name }}
        </Button>
      </div>
      <div class="grid grid-cols-1 gap-x-6 gap-y-3 sm:grid-cols-2">
        <RangeField
          label="Opacity"
          :model-value="currentSettings.opacity"
          :min="10"
          :max="100"
          :disabled="!enabledRatios[currentAspectRatio]"
          @update:model-value="updateOpacity"
        />
        <RangeField
          label="Scale"
          :model-value="currentSettings.scale"
          :min="5"
          :max="100"
          :disabled="!enabledRatios[currentAspectRatio]"
          @update:model-value="updateScale"
        />
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" @click="$emit('close')">Cancel</Button>
      <Button variant="primary" @click="savePosition">Save</Button>
    </template>
  </Modal>
</template>

<script setup lang="ts">
  defineOptions({ inheritAttrs: false });
  import { ref, computed, watch, reactive, onUnmounted } from 'vue';
  import { invoke, openFileDialog, resolveOverlayImagePath } from '@/services/creatorProfileRuntime';
  import {
    X,
    Move,
    Video,
    Monitor,
    Smartphone,
    Square,
    RectangleVertical,
    Upload,
    Loader2,
  } from 'lucide-vue-next';
  import { Button } from '@/components/ui/button';
  import { Checkbox } from '@/components/ui/checkbox';
  import { Modal } from '@/components/ui/modal';
  import { Switch } from '@/components/ui/switch';
  import RatioTabs from '@/components/branding/RatioTabs.vue';
  import RangeField from '@/components/branding/RangeField.vue';
  import type { OverlayRatioPosition, PerRatioOverlaySettings } from '@/types';
  import MediaPreview from '@/components/MediaPreview.vue';

  type AspectRatioId = '16:9' | '9:16' | '1:1' | '4:5';

  interface OrgAsset {
    id: number;
    url: string;
    asset_type?: string;
    [key: string]: any;
  }

  interface Props {
    show: boolean;
    overlayImagePath: string;
    overlayImageUrl?: string; // Server URL for organization mode
    overlayAssetId?: string | number | null; // Parent overlay's assetId for org-asset resolution
    overlayLabel?: string;
    settings?: PerRatioOverlaySettings | null;
    watermarkSettings?: any; // Watermark settings to render watermark in background
    watermarkUrl?: string; // Watermark URL for organization mode
    watermarkFilePath?: string; // Watermark file path for local mode
    orgAssets?: OrgAsset[]; // Organization assets for resolving per-ratio assetId to URL
  }

  const props = withDefaults(defineProps<Props>(), {
    overlayImageUrl: '',
    overlayLabel: '',
    settings: null,
  });

  const defaultPosition: OverlayRatioPosition = { x: 50, y: 50, width: 100, height: 10, opacity: 100, rotation: 0, scale: 100, isFullFrameOverlay: false };

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
  const overlayDataUrl = ref<string | null>(null);
  const loadingOverlay = ref(false);
  const measuredWidth = ref<number | null>(null);
  const measuredHeight = ref<number | null>(null);
  const currentAspectRatio = ref<AspectRatioId>('16:9');
  const uploadingRatioOverlay = ref(false);

  // Per-aspect-ratio overlay data URLs for preview
  const perRatioOverlayDataUrls = reactive<Record<AspectRatioId, string | null>>({
    '16:9': null,
    '9:16': null,
    '1:1': null,
    '4:5': null,
  });

  // Watermark state for rendering watermark in background
  const watermarkDataUrl = ref<string | null>(null);
  const loadingWatermark = ref(false);

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

  // Debug: Log overlay rendering state
  const shouldShowOverlay = computed(() => {
    const show = !!(overlayDataUrl.value && enabledRatios[currentAspectRatio.value]);
    console.log('[OverlayPositionPicker] Overlay render check:', {
      overlayDataUrl: overlayDataUrl.value ? `${overlayDataUrl.value.substring(0, 50)}...` : null,
      enabled: enabledRatios[currentAspectRatio.value],
      shouldShow: show,
      currentAspectRatio: currentAspectRatio.value,
    });
    return show;
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
      const style = {
        left: '0%',
        top: '0%',
        transform: 'none',
        width: '100%',
        height: '100%',
      };
      console.log('[OverlayPositionPicker] Overlay style (full-frame):', {
        style,
        isFullFrame,
        isFullFrameOverlay: isFullFrameOverlay.value,
        measuredWidth: measuredWidth.value,
        measuredHeight: measuredHeight.value,
        fullFrameOverlayRatios: { ...fullFrameOverlayRatios },
      });
      return style;
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
    // Check if current aspect ratio has its own overlay
    const currentSettings = localSettings[currentAspectRatio.value];
    const hasPerRatioOverlay = currentSettings.imagePath || currentSettings.assetId;

    // Priority: per-ratio overlay > parent overlay
    let imagePath = hasPerRatioOverlay ? currentSettings.imagePath : props.overlayImagePath;
    let imageUrl = '';
    if (hasPerRatioOverlay) {
      // Per-ratio overlay: resolve assetId to URL from orgAssets
      if (currentSettings.assetId && props.orgAssets?.length) {
        const asset = props.orgAssets.find(a => a.id === currentSettings.assetId);
        if (asset?.url) imageUrl = asset.url;
      }
    } else {
      imageUrl = props.overlayImageUrl || '';
    }

    console.log('[OverlayPositionPicker] Loading overlay:', {
      currentAspectRatio: currentAspectRatio.value,
      hasPerRatioOverlay,
      imagePath,
      imageUrl,
      propsImagePath: props.overlayImagePath,
      propsImageUrl: props.overlayImageUrl,
    });

    // If no imagePath and no imageUrl, try resolving org-asset assetId to a local cached file
    const assetIdStr = currentSettings.assetId != null ? String(currentSettings.assetId) : null;
    if (!imageUrl && !imagePath && assetIdStr) {
      try {
        const resolved = await resolveOverlayImagePath(null, assetIdStr);
        if (resolved) {
          imagePath = resolved;
          console.log('[OverlayPositionPicker] Resolved org asset to local path:', resolved);
        }
      } catch (err) {
        console.warn('[OverlayPositionPicker] Failed to resolve org asset:', err);
      }
    }
    // Also try parent overlay's assetId if no per-ratio overlay and no image yet
    if (!imageUrl && !imagePath && !hasPerRatioOverlay) {
      const parentAssetId = props.overlayAssetId != null ? String(props.overlayAssetId) : null;
      if (parentAssetId) {
        try {
            const resolved = await resolveOverlayImagePath(null, parentAssetId);
          if (resolved) {
            imagePath = resolved;
            console.log('[OverlayPositionPicker] Resolved parent org asset to local path:', resolved);
          }
        } catch (err) {
          console.warn('[OverlayPositionPicker] Failed to resolve parent org asset:', err);
        }
      }
    }

    if (!imageUrl && !imagePath) {
      console.log('[OverlayPositionPicker] No image URL or path provided');
      overlayDataUrl.value = null;
      measuredWidth.value = null;
      measuredHeight.value = null;
      return;
    }

    loadingOverlay.value = true;
    try {
      let dataUrl: string;

      if (imageUrl && imageUrl.startsWith('http')) {
        // Organization mode: download through Tauri to bypass CORS
        try {
          dataUrl = await invoke<string>('download_url_as_data_url', { url: imageUrl });
        } catch (downloadErr) {
          console.warn('[OverlayPositionPicker] Tauri download failed, using URL directly:', downloadErr);
          dataUrl = imageUrl;
        }
      } else if (imageUrl) {
        dataUrl = imageUrl;
      } else if (imagePath) {
        // Local mode: read from file system
        dataUrl = await invoke<string>('read_file_as_data_url', {
          filePath: imagePath,
        });
      } else {
        overlayDataUrl.value = null;
        measuredWidth.value = null;
        measuredHeight.value = null;
        return;
      }

      overlayDataUrl.value = dataUrl;
      perRatioOverlayDataUrls[currentAspectRatio.value] = dataUrl;

      console.log('[OverlayPositionPicker] Data URL generated, length:', dataUrl.length);
      console.log('[OverlayPositionPicker] Data URL preview:', dataUrl.substring(0, 100));
      console.log('[OverlayPositionPicker] Render state:', {
        overlayDataUrlSet: !!overlayDataUrl.value,
        currentAspectRatio: currentAspectRatio.value,
        isEnabled: enabledRatios[currentAspectRatio.value],
        enabledRatios: { ...enabledRatios },
        shouldRender: !!(overlayDataUrl.value && enabledRatios[currentAspectRatio.value]),
      });
      
      // Force a re-render by logging the actual overlay style
      console.log('[OverlayPositionPicker] Current overlay style:', overlayStyle.value);

      // For remote URLs (organization assets), skip dimension measurement
      // The MediaPreview component will handle display correctly
      if (imageUrl && imageUrl.startsWith('http')) {
        console.log('[OverlayPositionPicker] Remote URL detected, skipping dimension measurement');
        measuredWidth.value = null;
        measuredHeight.value = null;
        loadingOverlay.value = false;
        return;
      }

      // Measure image dimensions for local files
      const img = new Image();
      img.onload = () => {
        measuredWidth.value = img.naturalWidth;
        measuredHeight.value = img.naturalHeight;
        console.log(`[OverlayPositionPicker] Image dimensions: ${img.naturalWidth}x${img.naturalHeight}`);
      };
      img.onerror = (e) => {
        console.error('[OverlayPositionPicker] Failed to load image for measurement', {
          dataUrlPrefix: dataUrl.substring(0, 100),
          error: e,
        });
        measuredWidth.value = null;
        measuredHeight.value = null;
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
        let hasAnyEnabled = false;

        for (const ar of aspectRatios) {
          const id = ar.id;
          const incomingConfig = incoming?.[id];

          if (incomingConfig !== null && incomingConfig !== undefined) {
            enabledRatios[id] = true;
            localSettings[id] = { ...defaultPosition, ...incomingConfig };
            fullFrameOverlayRatios[id] = incomingConfig.isFullFrameOverlay ?? false;
            hasAnyEnabled = true;
          } else {
            enabledRatios[id] = false;
            localSettings[id] = { ...defaultPosition };
            fullFrameOverlayRatios[id] = false;
          }
        }

        // If no ratios are enabled from settings, enable 16:9 by default
        if (!hasAnyEnabled) {
          enabledRatios['16:9'] = true;
          console.log('[OverlayPositionPicker] No settings found, enabled 16:9 by default');
        }
        
        console.log('[OverlayPositionPicker] Initialized enabledRatios:', { ...enabledRatios });

        // Start on the first enabled ratio, or default to 16:9
        const firstEnabled = aspectRatios.find((ar) => enabledRatios[ar.id]);
        currentAspectRatio.value = firstEnabled?.id || '16:9';
        
        console.log('[OverlayPositionPicker] Initialized enabledRatios:', { ...enabledRatios });

        await loadOverlayImage();
        await loadWatermarkImage();
      }
    }
  );

  // Watch for changes to overlay path/URL and reload image
  watch(
    () => [props.overlayImagePath, props.overlayImageUrl],
    async () => {
      if (props.show) {
        await loadOverlayImage();
      }
    }
  );

  // Load watermark image for background rendering
  async function loadWatermarkImage() {
    console.log('[OverlayPositionPicker] loadWatermarkImage called:', {
      watermarkUrl: props.watermarkUrl?.substring(0, 80),
      watermarkFilePath: props.watermarkFilePath,
      watermarkSettings: props.watermarkSettings,
    });

    if (!props.watermarkUrl && !props.watermarkFilePath) {
      console.log('[OverlayPositionPicker] No watermark URL or file path');
      watermarkDataUrl.value = null;
      return;
    }

    loadingWatermark.value = true;
    try {
      if (props.watermarkUrl) {
        // For R2 URLs, download through Tauri to bypass CORS
        if (props.watermarkUrl.startsWith('http')) {
          console.log('[OverlayPositionPicker] Downloading watermark through Tauri to bypass CORS');
          watermarkDataUrl.value = await invoke<string>('download_url_as_data_url', { url: props.watermarkUrl });
        } else {
          watermarkDataUrl.value = props.watermarkUrl;
        }
      } else if (props.watermarkFilePath) {
        watermarkDataUrl.value = await invoke<string>('read_file_as_data_url', {
          filePath: props.watermarkFilePath,
        });
      }
      console.log('[OverlayPositionPicker] Watermark loaded, dataUrl length:', watermarkDataUrl.value?.length);
    } catch (err) {
      console.error('[OverlayPositionPicker] Failed to load watermark:', err);
      watermarkDataUrl.value = null;
    } finally {
      loadingWatermark.value = false;
    }
  }

  // Check if watermark is configured for current aspect ratio
  const hasWatermarkForCurrentRatio = computed(() => {
    const settings = props.watermarkSettings?.[currentAspectRatio.value];
    const has = !!(settings?.position);
    console.log('[OverlayPositionPicker] hasWatermarkForCurrentRatio:', {
      ratio: currentAspectRatio.value,
      settings,
      has,
      watermarkDataUrl: !!watermarkDataUrl.value,
    });
    return has;
  });

  // Computed watermark style for rendering watermark in background
  const watermarkStyle = computed(() => {
    const settings = props.watermarkSettings?.[currentAspectRatio.value];
    if (!settings?.position) return {};

    const pos = settings.position;
    if (pos.isFullFrameOverlay) {
      return {
        left: '0%',
        top: '0%',
        transform: 'none',
        width: '100%',
        height: '100%',
        opacity: (pos.opacity || 100) / 100,
      };
    }

    return {
      left: `${pos.x}%`,
      top: `${pos.y}%`,
      transform: 'translate(-50%, -50%)',
      width: `${pos.scale}%`,
      height: 'auto',
      opacity: (pos.opacity || 100) / 100,
    };
  });

  async function selectAspectRatio(id: AspectRatioId) {
    currentAspectRatio.value = id;
    await loadOverlayImage();
  }

  async function uploadOverlayForCurrentRatio() {
    if (uploadingRatioOverlay.value) return;
    uploadingRatioOverlay.value = true;
    try {
      const open = openFileDialog;
      const result = await open({
        multiple: false,
        filters: [{ name: 'Images & Videos', extensions: ['png', 'svg', 'webp', 'jpg', 'jpeg', 'mp4', 'mov', 'webm'] }],
      });
      if (!result) return;
      let filePath = result as string;

      // Check if it's a video file that needs conversion
      const videoExtensions = ['mov', 'webm', 'avi', 'mkv'];
      const extension = filePath.split('.').pop()?.toLowerCase() || '';
      
      if (videoExtensions.includes(extension)) {
        console.log('[OverlayPositionPicker] Converting video to MP4:', filePath);
        try {
          // Convert video to browser-compatible MP4
          filePath = await invoke<string>('convert_video_to_mp4', { inputPath: filePath });
          console.log('[OverlayPositionPicker] Video converted successfully:', filePath);
        } catch (conversionError) {
          console.error('[OverlayPositionPicker] Video conversion failed:', conversionError);
          // Continue with original file - it might still work
        }
      }

      // Store the file path in the current aspect ratio settings
      localSettings[currentAspectRatio.value].imagePath = filePath;
      localSettings[currentAspectRatio.value].assetId = null;

      console.log('[OverlayPositionPicker] Uploaded overlay for ratio:', currentAspectRatio.value, 'filePath:', filePath);

      // Enable this ratio if not already enabled
      if (!enabledRatios[currentAspectRatio.value]) {
        enabledRatios[currentAspectRatio.value] = true;
        console.log('[OverlayPositionPicker] Enabled ratio:', currentAspectRatio.value);
      }

      console.log('[OverlayPositionPicker] Current enabledRatios after upload:', { ...enabledRatios });

      // Reload the overlay image
      await loadOverlayImage();
      
      console.log('[OverlayPositionPicker] After loadOverlayImage, overlayDataUrl length:', overlayDataUrl.value?.length || 0);
    } catch (err: any) {
      console.error('[OverlayPositionPicker] Failed to upload overlay:', err);
    } finally {
      uploadingRatioOverlay.value = false;
    }
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
    console.error('[OverlayPositionPicker] MediaPreview error:', {
      target: event.target,
      overlayDataUrl: overlayDataUrl.value?.substring(0, 100),
    });
    // Don't hide the element - let it show as a broken video/image
    // The user can still adjust position/scale even if preview doesn't work
  }

  function savePosition() {
    const buildRatioSettings = (ratio: AspectRatioId): OverlayRatioPosition | null => {
      if (!enabledRatios[ratio]) return null;
      return {
        ...localSettings[ratio],
        isFullFrameOverlay: fullFrameOverlayRatios[ratio] || isFullFrameOverlay.value,
        imagePath: localSettings[ratio].imagePath,
        assetId: localSettings[ratio].assetId,
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
