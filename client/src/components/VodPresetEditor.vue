<template>
  <Modal
    :open="modelValue && !showFramingEditor"
    title="VOD pre-edit settings"
    description="Aspect ratio, framing, overlays and watermark applied before clip detection."
    :icon="LayoutDashboardIcon"
    size="lg"
    footer-class="justify-between"
    @close="close"
  >
    <div class="flex flex-col gap-5">
      <!-- Aspect ratio & template -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Aspect ratio & template" :icon="RatioIcon" />
        <SegmentedControl v-model="selectedAspectRatio" :options="aspectRatioSegments" class="self-start" />
        <div class="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <button
                type="button"
                class="flex h-[var(--control-md)] min-w-0 flex-1 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised px-2.5 text-left text-sm text-fg transition-colors hover:border-line-strong data-[state=open]:border-line-strong"
              >
                <span class="min-w-0 flex-1 truncate" :class="{ 'text-fg-subtle': !selectedTemplateLabel }">
                  {{ selectedTemplateLabel || 'No template' }}
                </span>
                <ChevronDownIcon class="size-3.5 shrink-0 text-fg-subtle" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="max-h-64 w-[var(--reka-dropdown-menu-trigger-width)] overflow-y-auto">
              <DropdownMenuItem
                v-for="option in availableTemplatesOptions"
                :key="option.value"
                class="group/item pr-1"
                @select="handleTemplateChange(option.value)"
              >
                <span class="min-w-0 flex-1 truncate">{{ option.label }}</span>
                <CheckIcon v-if="selectedTemplateId === option.value" class="!text-brand" />
                <button
                  type="button"
                  class="grid size-6 shrink-0 place-items-center rounded text-fg-subtle opacity-0 transition hover:text-danger group-hover/item:opacity-100 group-data-[highlighted]/item:opacity-100"
                  title="Delete template"
                  aria-label="Delete template"
                  @click.stop="deleteTemplate(option.value, $event)"
                >
                  <Trash2Icon class="size-3.5" />
                </button>
              </DropdownMenuItem>
              <p v-if="availableTemplatesOptions.length === 0" class="px-2 py-2 text-xs text-fg-subtle">
                No saved templates yet
              </p>
            </DropdownMenuContent>
          </DropdownMenu>
          <Button variant="secondary" @click="showSaveTemplate = true">
            <SaveIcon />
            Save template
          </Button>
        </div>
      </section>

      <!-- Framing -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Framing" :icon="CropIcon" :count="framingConfig?.regions?.length || 0">
          <Button variant="secondary" size="sm" @click="openFramingEditor">
            {{ (framingConfig?.regions?.length || 0) > 0 ? 'Edit framing' : 'Configure framing' }}
          </Button>
        </SectionHeader>
        <div v-if="framingConfig?.regions && framingConfig.regions.length > 0" class="flex flex-wrap gap-2">
          <div
            v-for="(region, idx) in framingConfig.regions"
            :key="region.id"
            class="flex items-center gap-2 rounded-lg border border-line-subtle bg-surface px-2.5 py-1.5"
          >
            <span class="size-2.5 rounded-full" :style="{ backgroundColor: region.color }" />
            <span class="text-xs text-fg">{{ region.label || `Region ${idx + 1}` }}</span>
            <span class="tabular font-mono text-2xs text-fg-subtle">
              {{ Math.round(region.source.width * 100) }}×{{ Math.round(region.source.height * 100) }}%
            </span>
          </div>
        </div>
        <p v-else class="text-xs text-fg-subtle">
          No framing configured — clips will use the default center crop for {{ selectedAspectRatio }}.
        </p>
      </section>

      <!-- Layout overlays -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Layout overlays" :icon="LayersIcon" :count="layoutOverlays.length">
          <Button v-if="!hasCreatorProfile" variant="secondary" size="sm" @click="addLayoutOverlay">
            <PlusIcon />
            Add overlay
          </Button>
        </SectionHeader>
        <p
          v-if="hasCreatorProfile"
          class="flex items-start gap-2 text-xs text-fg-muted"
        >
          <InfoIcon class="mt-px size-3.5 shrink-0 text-fg-subtle" />
          Layout overlay settings are managed by the creator profile and cannot be changed here.
        </p>
        <div
          v-if="layoutOverlays.length > 0"
          class="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface"
        >
          <OverlayRow
            v-for="(overlay, idx) in layoutOverlays"
            :key="overlay.id"
            v-model:label="overlay.label"
            :preview-url="overlayPreviews[overlay.id]"
            :placeholder="`Overlay ${idx + 1}`"
          >
            <template #meta>
              {{ overlay.x.toFixed(0) }}%, {{ overlay.y.toFixed(0) }}% · {{ overlay.width.toFixed(0) }}×{{
                overlay.height.toFixed(0)
              }}% · {{ overlay.opacity }}% opacity
              <span v-if="overlayConfiguredRatioCount(overlay) > 0" class="text-brand">
                · {{ overlayConfiguredRatioCount(overlay) }}/4 ratios
              </span>
            </template>
            <template v-if="!hasCreatorProfile" #actions>
              <Button
                variant="ghost"
                size="xs"
                title="Configure position per aspect ratio"
                @click="openOverlayPositionPicker(idx)"
              >
                <MoveIcon />
                Position
              </Button>
              <Button
                variant="ghost"
                size="icon-sm"
                class="hover:text-danger"
                title="Remove overlay"
                aria-label="Remove overlay"
                @click="removeLayoutOverlay(idx)"
              >
                <Trash2Icon />
              </Button>
            </template>
          </OverlayRow>
        </div>
        <p
          v-else-if="!hasCreatorProfile"
          class="text-xs text-fg-subtle"
        >
          No layout overlays — add border images, dividers or decorative elements.
        </p>
      </section>

      <!-- Watermark -->
      <section class="flex flex-col gap-2.5">
        <SectionHeader title="Watermark" :icon="StampIcon" />
        <p
          v-if="hasCreatorProfile"
          class="flex items-start gap-2 text-xs text-fg-muted"
        >
          <InfoIcon class="mt-px size-3.5 shrink-0 text-fg-subtle" />
          This project has a creator profile attached. Watermark settings are managed by the creator profile and cannot
          be changed here.
        </p>
        <template v-else>
          <SegmentedControl v-model="watermarkMode" :options="watermarkModeOptions" class="self-start" />
          <div v-if="watermarkMode === 'custom'" class="flex animate-enter flex-col gap-3">
            <Field label="Watermark image">
              <template #label-end>
                <Button variant="link" size="xs" :disabled="uploadingCustomWatermark" @click="uploadCustomWatermark">
                  {{ uploadingCustomWatermark ? 'Uploading…' : 'Upload new' }}
                </Button>
              </template>
              <AssetSelect
                :model-value="selectedCustomWatermarkId"
                :options="customWatermarkList"
                :icon="ImageIcon"
                :clearable="false"
                :preview="(id) => customWatermarkPreviews[id]"
                none-label="Select watermark…"
                empty-label="No watermarks available. Upload one above."
                @update:model-value="onCustomWatermarkPicked"
              />
            </Field>
            <div v-if="selectedCustomWatermarkId" class="flex items-center gap-2">
              <Button variant="secondary" size="sm" @click="openWatermarkPositionPicker">
                <MoveIcon />
                Configure position
              </Button>
              <Badge v-if="watermarkConfiguredRatioCount > 0" variant="brand">
                {{ watermarkConfiguredRatioCount }}/4 ratios
              </Badge>
            </div>
          </div>
        </template>
      </section>
    </div>

    <template #footer>
      <p class="min-w-0 truncate text-xs text-fg-muted">
        Target <span class="font-medium text-fg">{{ selectedAspectRatio }}</span>
        <template v-if="framingConfig?.regions && framingConfig.regions.length > 0">
          · {{ framingConfig.regions.length }} region{{ framingConfig.regions.length !== 1 ? 's' : '' }}
        </template>
        <template v-if="layoutOverlays.length > 0">
          · {{ layoutOverlays.length }} overlay{{ layoutOverlays.length !== 1 ? 's' : '' }}
        </template>
      </p>
      <div class="flex shrink-0 items-center gap-2">
        <Button v-if="hasExistingConfig" variant="destructive-soft" @click="clearPreset">Remove pre-edit</Button>
        <Button variant="ghost" @click="close">Cancel</Button>
        <Button variant="primary" @click="confirmConfig">
          <CheckIcon />
          Apply pre-edit
        </Button>
      </div>
    </template>
  </Modal>

  <!-- Framing Editor Sub-Dialog -->
  <ManualPOIEditor
    v-model="showFramingEditor"
    :initial-config="currentFramingConfig"
    :target-aspect-ratio="selectedAspectRatio"
    :source-aspect-ratio="sourceAspectRatio"
    :thumbnail-url="thumbnailUrl"
    :video-path="videoPath"
    :clip-start-time="0"
    :clip-end-time="videoDuration"
    :full-video-duration="videoDuration"
    :watermark-settings="null"
    :layout-overlays="layoutOverlays"
    :overlay-preview-urls="overlayPreviewsRef"
    @confirm="onFramingConfirmed"
  />

  <!-- Save Template Dialog -->
  <Modal
    :open="showSaveTemplate"
    title="Save as template"
    description="Reuse this aspect ratio, framing and overlay setup on other VODs."
    :icon="SaveIcon"
    size="sm"
    @close="showSaveTemplate = false"
  >
    <Field label="Template name">
      <Input v-model="templateName" placeholder="e.g. Podcast split screen" @keydown.enter="saveTemplate" />
    </Field>
    <template #footer>
      <Button variant="ghost" @click="showSaveTemplate = false">Cancel</Button>
      <Button variant="primary" :disabled="!templateName.trim()" @click="saveTemplate">Save</Button>
    </template>
  </Modal>

  <!-- Watermark Position Picker Sub-Dialog -->
  <WatermarkPositionPicker
    :show="showWatermarkPositionPickerDialog"
    :watermark-file-path="selectedCustomWatermarkFilePath"
    :watermark-id="selectedCustomWatermarkId"
    :watermark-width="selectedCustomWatermarkDimensions.width"
    :watermark-height="selectedCustomWatermarkDimensions.height"
    :settings="customWatermarkPositionSettings || undefined"
    @close="showWatermarkPositionPickerDialog = false"
    @save="handleWatermarkPositionSave"
  />

  <!-- Overlay Position Picker Sub-Dialog -->
  <OverlayPositionPicker
    :show="showOverlayPositionPickerDialog"
    :overlay-image-path="activeOverlayForPosition?.imagePath || ''"
    :overlay-image-url="activeOverlayForPosition ? overlayPreviews[activeOverlayForPosition.id] || '' : ''"
    :overlay-asset-id="activeOverlayForPosition?.assetId"
    :overlay-label="activeOverlayForPosition?.label || ''"
    :settings="activeOverlayForPosition?.perRatioSettings || undefined"
    @close="showOverlayPositionPickerDialog = false"
    @save="handleOverlayPositionSave"
  />
</template>

<script setup lang="ts">
  import { ref, watch, computed, reactive } from 'vue';
  import { invoke } from '@tauri-apps/api/core';
  import {
    LayoutDashboardIcon,
    XIcon,
    CheckIcon,
    PlusIcon,
    Trash2Icon,
    SaveIcon,
    CropIcon,
    LayersIcon,
    ImageIcon,
    EyeOffIcon,
    UserIcon,
    InfoIcon,
    RatioIcon,
    StampIcon,
    MoveIcon,
    ChevronDownIcon,
    XCircleIcon,
  } from 'lucide-vue-next';
  import ManualPOIEditor from './poi/ManualPOIEditor.vue';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from './WatermarkPositionPicker.vue';
  import OverlayPositionPicker from './OverlayPositionPicker.vue';
  import type { DropdownOption } from './CustomDropdown.vue';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Field } from '@/components/ui/field';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import AssetSelect from './creators/AssetSelect.vue';
  import OverlayRow from './branding/OverlayRow.vue';
  import { getAllWatermarkImages, resolveOverlayImagePath, type WatermarkImage } from '@/services/database/watermarks';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import type {
    ManualRegion,
    ManualFramingConfig,
    LayoutOverlay,
    ActiveVodPresetConfig,
    VodPreset,
    WatermarkSettings,
    PerRatioOverlaySettings,
    SubtitleSettings,
  } from '@/types';
  import {
    getAllVodPresets,
    getVodPresetsByCreator,
    getVodPresetsUnlinked,
    createVodPreset,
    updateVodPreset as updateVodPresetDb,
    deleteVodPreset,
  } from '@/services/database/vod-presets';
  import { resolveAutoBrandingProfile } from '@/composables/useBrandingProfileSelection';
  import { parseCreatorClipBuildDefaults } from '@/composables/useCreatorClipDefaults';

  interface Props {
    modelValue: boolean;
    projectId: string;
    initialConfig?: ActiveVodPresetConfig | null;
    creatorProfileId?: string | null;
    thumbnailUrl?: string | null;
    videoPath?: string | null;
    videoDuration?: number;
    sourceAspectRatio?: string;
  }

  const props = withDefaults(defineProps<Props>(), {
    initialConfig: null,
    creatorProfileId: null,
    thumbnailUrl: null,
    videoPath: null,
    videoDuration: 0,
    sourceAspectRatio: '16:9',
  });

  const emit = defineEmits<{
    'update:modelValue': [value: boolean];
    confirm: [config: ActiveVodPresetConfig];
    clear: [];
    'save-template': [preset: VodPreset];
  }>();

  // Aspect ratio options
  const aspectRatioOptions = [
    { value: '16:9', label: '16:9', previewW: 16, previewH: 9 },
    { value: '9:16', label: '9:16', previewW: 9, previewH: 16 },
    { value: '1:1', label: '1:1', previewW: 12, previewH: 12 },
    { value: '4:5', label: '4:5', previewW: 10, previewH: 12 },
  ];

  // State
  const selectedAspectRatio = ref('9:16');
  const framingConfig = ref<ManualFramingConfig | null>(null);
  const layoutOverlays = ref<LayoutOverlay[]>([]);
  const watermarkMode = ref<'creator' | 'custom' | 'none'>('none');
  const customWatermarkSettings = ref<WatermarkSettings | null>(null);
  const subtitleDefaults = ref<SubtitleSettings | null>(null);
  const overlayPreviews = reactive<Record<string, string>>({});
  // Ref-based copy to trigger prop reactivity in child components (ManualPOIEditor)
  // reactive() mutations don't propagate as prop changes; ref does
  const overlayPreviewsRef = ref<Record<string, string>>({});

  // Template state
  const selectedTemplateId = ref('');
  const availableTemplates = ref<VodPreset[]>([]);
  const showSaveTemplate = ref(false);
  const templateName = ref('');
  const templateLinkToCreator = ref(false);

  // Framing editor state
  const showFramingEditor = ref(false);

  // Watermark operations
  const { uploadWatermark } = useWatermarkOperations();

  // Custom watermark state
  const customWatermarkList = ref<WatermarkImage[]>([]);
  const customWatermarkPreviews = reactive<Record<string, string>>({});
  const selectedCustomWatermarkId = ref<string | null>(null);
  const showCustomWatermarkDropdown = ref(false);
  const uploadingCustomWatermark = ref(false);
  const customWatermarkPositionSettings = ref<CreatorWatermarkSettings | null>(null);

  // Watermark position picker dialog state
  const showWatermarkPositionPickerDialog = ref(false);

  // Overlay position picker dialog state
  const showOverlayPositionPickerDialog = ref(false);
  const activeOverlayIndex = ref<number>(-1);

  // Track if any profile (creator, org-streamer, or campaign) is being applied
  const hasResolvedProfile = ref(false);
  const activeOverlayForPosition = computed(() => {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= layoutOverlays.value.length) return null;
    return layoutOverlays.value[activeOverlayIndex.value];
  });

  // Computed watermark properties
  const selectedCustomWatermarkPreview = computed(() => {
    if (!selectedCustomWatermarkId.value) return null;
    return customWatermarkPreviews[selectedCustomWatermarkId.value] || null;
  });

  const selectedCustomWatermarkName = computed(() => {
    if (!selectedCustomWatermarkId.value) return null;
    const wm = customWatermarkList.value.find((w) => w.id === selectedCustomWatermarkId.value);
    return wm?.name || null;
  });

  const selectedCustomWatermarkFilePath = computed(() => {
    if (!selectedCustomWatermarkId.value) return undefined;
    const wm = customWatermarkList.value.find((w) => w.id === selectedCustomWatermarkId.value);
    return wm?.file_path;
  });

  const selectedCustomWatermarkDimensions = computed(() => {
    if (!selectedCustomWatermarkId.value) return { width: null, height: null };
    const wm = customWatermarkList.value.find((w) => w.id === selectedCustomWatermarkId.value);
    return { width: wm?.width ?? null, height: wm?.height ?? null };
  });

  const watermarkConfiguredRatioCount = computed(() => {
    if (!customWatermarkPositionSettings.value) return 0;
    const s = customWatermarkPositionSettings.value;
    return [s['16:9'], s['9:16'], s['1:1'], s['4:5']].filter((v) => v !== null && v !== undefined).length;
  });

  function overlayConfiguredRatioCount(overlay: LayoutOverlay): number {
    if (!overlay.perRatioSettings) return 0;
    const s = overlay.perRatioSettings;
    return [s['16:9'], s['9:16'], s['1:1'], s['4:5']].filter((v) => v !== null && v !== undefined).length;
  }

  const hasCreatorProfile = computed(() => {
    const result = !!props.creatorProfileId || hasResolvedProfile.value;
    console.log('[VodPresetEditor] hasCreatorProfile:', result, 'creatorProfileId:', props.creatorProfileId, 'hasResolvedProfile:', hasResolvedProfile.value);
    return result;
  });
  const hasExistingConfig = computed(() => !!props.initialConfig);

  const availableTemplatesOptions = computed<DropdownOption[]>(() =>
    availableTemplates.value.map((t) => ({
      label: `${t.name} (${t.targetAspectRatio})`,
      value: t.id,
    }))
  );

  const selectedTemplateLabel = computed(
    () => availableTemplatesOptions.value.find((o) => o.value === selectedTemplateId.value)?.label ?? ''
  );

  const aspectRatioSegments: SegmentedOption<string>[] = aspectRatioOptions.map((r) => ({ value: r.value, label: r.label }));

  const watermarkModeOptions: SegmentedOption<'creator' | 'custom' | 'none'>[] = [
    { value: 'custom', label: 'Custom watermark', icon: ImageIcon },
    { value: 'none', label: 'No watermark', icon: EyeOffIcon },
  ];

  function onCustomWatermarkPicked(id: string | null) {
    const wm = customWatermarkList.value.find((w) => w.id === id);
    if (wm) selectCustomWatermark(wm);
  }

  function handleTemplateChange(val: string) {
    selectedTemplateId.value = val;
    onTemplateSelected();
  }

  const currentFramingConfig = computed((): ManualFramingConfig | null => {
    return framingConfig.value;
  });

  // Load templates
  async function loadTemplates() {
    try {
      if (props.creatorProfileId) {
        const creatorPresets = await getVodPresetsByCreator(props.creatorProfileId);
        const globalPresets = await getVodPresetsUnlinked();
        availableTemplates.value = [...creatorPresets, ...globalPresets];
      } else {
        availableTemplates.value = await getAllVodPresets();
      }
    } catch (error) {
      console.error('[VodPresetEditor] Failed to load templates:', error);
    }
  }

  // Handle template selection
  function onTemplateSelected() {
    if (!selectedTemplateId.value) return;
    const template = availableTemplates.value.find((t) => t.id === selectedTemplateId.value);
    if (!template) return;

    selectedAspectRatio.value = template.targetAspectRatio;
    framingConfig.value = template.framingConfig
      ? JSON.parse(JSON.stringify(template.framingConfig))
      : null;
    layoutOverlays.value = template.layoutOverlays
      ? JSON.parse(JSON.stringify(template.layoutOverlays))
      : [];
    watermarkMode.value = template.watermarkMode;
    customWatermarkSettings.value = template.customWatermarkSettings
      ? JSON.parse(JSON.stringify(template.customWatermarkSettings))
      : null;

    // Load overlay previews
    loadOverlayPreviews();
  }

  // Open framing editor
  function openFramingEditor() {
    showFramingEditor.value = true;
  }

  // Handle framing confirmed from ManualPOIEditor
  function onFramingConfirmed(config: ManualFramingConfig) {
    framingConfig.value = JSON.parse(JSON.stringify(config));
  }

  // Layout overlay management
  async function addLayoutOverlay() {
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: false,
        filters: [{ name: 'Images & Videos', extensions: ['png', 'svg', 'webp', 'jpg', 'jpeg', 'mp4', 'mov', 'webm'] }],
      });

      if (!result) return;
      const filePath = result as string;

      // Auto-configure the overlay for the currently selected aspect ratio
      const ratioKey = selectedAspectRatio.value as '16:9' | '9:16' | '1:1' | '4:5';
      const defaultRatioPosition = {
        x: 50,
        y: 50,
        width: 100,
        height: 10,
        opacity: 100,
        rotation: 0,
        scale: 20,
        isFullFrameOverlay: false,
        imagePath: filePath,
      };

      const newOverlay: LayoutOverlay = {
        id: crypto.randomUUID(),
        imagePath: filePath,
        x: 50,
        y: 50,
        width: 100,
        height: 10,
        opacity: 100,
        rotation: 0,
        label: '',
        perRatioSettings: {
          '16:9': ratioKey === '16:9' ? defaultRatioPosition : null,
          '9:16': ratioKey === '9:16' ? defaultRatioPosition : null,
          '1:1': ratioKey === '1:1' ? defaultRatioPosition : null,
          '4:5': ratioKey === '4:5' ? defaultRatioPosition : null,
        },
      };

      layoutOverlays.value.push(newOverlay);
      await loadOverlayPreview(newOverlay);
    } catch (error) {
      console.error('[VodPresetEditor] Failed to add overlay:', error);
    }
  }

  function removeLayoutOverlay(index: number) {
    const overlay = layoutOverlays.value[index];
    if (overlay) {
      delete overlayPreviews[overlay.id];
      const copy = { ...overlayPreviewsRef.value };
      delete copy[overlay.id];
      overlayPreviewsRef.value = copy;
    }
    layoutOverlays.value.splice(index, 1);
  }

  async function loadOverlayPreview(overlay: LayoutOverlay) {
    try {
      console.log('[VodPresetEditor] loadOverlayPreview:', overlay.id, 'imagePath:', overlay.imagePath, 'assetId:', overlay.assetId);
      // Resolve the overlay image path (handles both local files and org-asset- prefixed IDs)
      const resolvedPath = await resolveOverlayImagePath(overlay.imagePath, overlay.assetId);
      console.log('[VodPresetEditor] resolvedPath:', resolvedPath);
      if (!resolvedPath) {
        console.warn('[VodPresetEditor] Could not resolve overlay image path for:', overlay.id, 'assetId:', overlay.assetId);
        return;
      }
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: resolvedPath });
      overlayPreviews[overlay.id] = dataUrl;
      // Sync to ref for ManualPOIEditor prop reactivity
      overlayPreviewsRef.value = { ...overlayPreviewsRef.value, [overlay.id]: dataUrl };
      console.log('[VodPresetEditor] Overlay preview loaded successfully for:', overlay.id, 'dataUrl length:', dataUrl?.length);
    } catch (error) {
      console.warn('[VodPresetEditor] Failed to load overlay preview:', error);
    }
  }

  async function loadOverlayPreviews() {
    console.log('[VodPresetEditor] loadOverlayPreviews called, count:', layoutOverlays.value.length);
    for (const overlay of layoutOverlays.value) {
      await loadOverlayPreview(overlay);
    }
    console.log('[VodPresetEditor] overlayPreviews after load:', Object.keys(overlayPreviews));
  }

  // ==========================================
  // Custom Watermark Management
  // ==========================================

  async function loadCustomWatermarks() {
    try {
      customWatermarkList.value = await getAllWatermarkImages();
      for (const wm of customWatermarkList.value) {
        if (!customWatermarkPreviews[wm.id]) {
          try {
            const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: wm.file_path });
            customWatermarkPreviews[wm.id] = dataUrl;
          } catch (err) {
            console.warn('[VodPresetEditor] Failed to load watermark preview:', wm.id, err);
          }
        }
      }
    } catch (error) {
      console.error('[VodPresetEditor] Failed to load watermarks:', error);
    }
  }

  function selectCustomWatermark(wm: WatermarkImage) {
    selectedCustomWatermarkId.value = wm.id;
    showCustomWatermarkDropdown.value = false;

    // Update the customWatermarkSettings with the selected watermark ID
    if (!customWatermarkSettings.value) {
      customWatermarkSettings.value = {
        enabled: true,
        watermarkId: wm.id,
        positionX: 12,
        positionY: 92,
        opacity: 80,
        scale: 20,
        width: wm.width ?? null,
        height: wm.height ?? null,
      };
    } else {
      customWatermarkSettings.value.watermarkId = wm.id;
      customWatermarkSettings.value.enabled = true;
      customWatermarkSettings.value.width = wm.width ?? null;
      customWatermarkSettings.value.height = wm.height ?? null;
    }
  }

  async function uploadCustomWatermark() {
    if (uploadingCustomWatermark.value) return;
    uploadingCustomWatermark.value = true;

    try {
      const result = await uploadWatermark();
      if (result.success && result.watermarkId) {
        await loadCustomWatermarks();
        const newWm = customWatermarkList.value.find((w) => w.id === result.watermarkId);
        if (newWm) {
          selectCustomWatermark(newWm);
        }
      }
    } catch (err) {
      console.error('[VodPresetEditor] Failed to upload watermark:', err);
    } finally {
      uploadingCustomWatermark.value = false;
    }
  }

  function openWatermarkPositionPicker() {
    if (!selectedCustomWatermarkId.value) return;
    showWatermarkPositionPickerDialog.value = true;
  }

  function handleWatermarkPositionSave(settings: CreatorWatermarkSettings) {
    customWatermarkPositionSettings.value = settings;
    showWatermarkPositionPickerDialog.value = false;

    // Also update the customWatermarkSettings with per-ratio data
    if (customWatermarkSettings.value) {
      // Map CreatorWatermarkSettings to WatermarkSettings.perRatioSettings
      customWatermarkSettings.value.perRatioSettings = {
        '16:9': settings['16:9'] ? {
          watermarkId: settings['16:9'].watermarkId,
          position: settings['16:9'].position,
        } : null,
        '9:16': settings['9:16'] ? {
          watermarkId: settings['9:16'].watermarkId,
          position: settings['9:16'].position,
        } : null,
        '1:1': settings['1:1'] ? {
          watermarkId: settings['1:1'].watermarkId,
          position: settings['1:1'].position,
        } : null,
        '4:5': settings['4:5'] ? {
          watermarkId: settings['4:5'].watermarkId,
          position: settings['4:5'].position,
        } : null,
      };

      // Update main position from the first enabled ratio
      const firstEnabled = settings['16:9'] || settings['9:16'] || settings['1:1'] || settings['4:5'];
      if (firstEnabled?.position) {
        customWatermarkSettings.value.positionX = firstEnabled.position.x;
        customWatermarkSettings.value.positionY = firstEnabled.position.y;
        customWatermarkSettings.value.opacity = firstEnabled.position.opacity;
        customWatermarkSettings.value.scale = firstEnabled.position.scale;
        customWatermarkSettings.value.isFullFrameOverlay = firstEnabled.position.isFullFrameOverlay;
      }
    }
  }

  // ==========================================
  // Overlay Position Management
  // ==========================================

  function openOverlayPositionPicker(idx: number) {
    activeOverlayIndex.value = idx;
    showOverlayPositionPickerDialog.value = true;
  }

  function handleOverlayPositionSave(settings: PerRatioOverlaySettings) {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= layoutOverlays.value.length) return;

    const overlay = layoutOverlays.value[activeOverlayIndex.value];
    overlay.perRatioSettings = settings;

    // Also update the flat position fields from the first enabled ratio as defaults
    const firstEnabled = settings['16:9'] || settings['9:16'] || settings['1:1'] || settings['4:5'];
    if (firstEnabled) {
      overlay.x = firstEnabled.x;
      overlay.y = firstEnabled.y;
      overlay.width = firstEnabled.width;
      overlay.height = firstEnabled.height;
      overlay.opacity = firstEnabled.opacity;
      overlay.rotation = firstEnabled.rotation;
    }

    showOverlayPositionPickerDialog.value = false;
  }

  // Save template
  async function saveTemplate() {
    if (!templateName.value.trim()) return;

    try {
      const id = await createVodPreset({
        name: templateName.value.trim(),
        creatorProfileId: templateLinkToCreator.value ? props.creatorProfileId : null,
        targetAspectRatio: selectedAspectRatio.value,
        framingConfig: currentFramingConfig.value,
        layoutOverlays: layoutOverlays.value,
        watermarkMode: watermarkMode.value,
        customWatermarkSettings: customWatermarkSettings.value,
      });

      console.log('[VodPresetEditor] Template saved:', id);
      showSaveTemplate.value = false;
      templateName.value = '';
      templateLinkToCreator.value = false;

      // Reload templates
      await loadTemplates();
      selectedTemplateId.value = id;
    } catch (error) {
      console.error('[VodPresetEditor] Failed to save template:', error);
    }
  }

  // Delete template
  async function deleteTemplate(templateId: string, event: Event) {
    event.stopPropagation();
    
    try {
      await deleteVodPreset(templateId);
      console.log('[VodPresetEditor] Template deleted:', templateId);
      
      // If the deleted template was selected, clear selection
      if (selectedTemplateId.value === templateId) {
        selectedTemplateId.value = '';
      }
      
      // Reload templates
      await loadTemplates();
    } catch (error) {
      console.error('[VodPresetEditor] Failed to delete template:', error);
    }
  }

  // Clear preset
  function clearPreset() {
    emit('clear');
    close();
  }

  // Confirm config
  function confirmConfig() {
    const config: ActiveVodPresetConfig = {
      presetId: selectedTemplateId.value || null,
      targetAspectRatio: selectedAspectRatio.value,
      framingConfig: currentFramingConfig.value,
      layoutOverlays: JSON.parse(JSON.stringify(layoutOverlays.value)),
      watermarkMode: watermarkMode.value,
      customWatermarkSettings: customWatermarkSettings.value
        ? JSON.parse(JSON.stringify(customWatermarkSettings.value))
        : null,
      subtitleDefaults: subtitleDefaults.value
        ? JSON.parse(JSON.stringify(subtitleDefaults.value))
        : null,
    };

    emit('confirm', config);
    close();
  }

  // Close
  function close() {
    emit('update:modelValue', false);
  }

  // Initialize when dialog opens
  watch(
    () => props.modelValue,
    async (isOpen) => {
      if (isOpen) {
        console.log('[VodPresetEditor] Dialog opened with creatorProfileId:', props.creatorProfileId, 'hasCreatorProfile:', hasCreatorProfile.value);
        // Load from initial config or defaults
        if (props.initialConfig) {
          selectedAspectRatio.value = props.initialConfig.targetAspectRatio;
          framingConfig.value = props.initialConfig.framingConfig
            ? JSON.parse(JSON.stringify(props.initialConfig.framingConfig))
            : null;
          layoutOverlays.value = props.initialConfig.layoutOverlays
            ? JSON.parse(JSON.stringify(props.initialConfig.layoutOverlays))
            : [];
          watermarkMode.value = props.initialConfig.watermarkMode;
          customWatermarkSettings.value = props.initialConfig.customWatermarkSettings
            ? JSON.parse(JSON.stringify(props.initialConfig.customWatermarkSettings))
            : null;
          subtitleDefaults.value = props.initialConfig.subtitleDefaults
            ? JSON.parse(JSON.stringify(props.initialConfig.subtitleDefaults))
            : null;
          selectedTemplateId.value = props.initialConfig.presetId || '';

          // Restore custom watermark selection from saved settings
          if (customWatermarkSettings.value?.watermarkId) {
            selectedCustomWatermarkId.value = customWatermarkSettings.value.watermarkId;
          } else {
            selectedCustomWatermarkId.value = null;
          }

          // Restore watermark position settings from perRatioSettings
          if (customWatermarkSettings.value?.perRatioSettings) {
            const prs = customWatermarkSettings.value.perRatioSettings;
            customWatermarkPositionSettings.value = {
              '16:9': prs['16:9'] ? { watermarkId: prs['16:9'].watermarkId, position: prs['16:9'].position } : null,
              '9:16': prs['9:16'] ? { watermarkId: prs['9:16'].watermarkId, position: prs['9:16'].position } : null,
              '1:1': prs['1:1'] ? { watermarkId: prs['1:1'].watermarkId, position: prs['1:1'].position } : null,
              '4:5': prs['4:5'] ? { watermarkId: prs['4:5'].watermarkId, position: prs['4:5'].position } : null,
            };
          } else {
            customWatermarkPositionSettings.value = null;
          }
        } else {
          selectedAspectRatio.value = '9:16';
          framingConfig.value = null;
          layoutOverlays.value = [];
          watermarkMode.value = hasCreatorProfile.value ? 'creator' : 'none';
          customWatermarkSettings.value = null;
          subtitleDefaults.value = null;
          selectedTemplateId.value = '';
          selectedCustomWatermarkId.value = null;
          customWatermarkPositionSettings.value = null;

          // Auto-pull creator profile settings (handles local + org-assigned + campaign profiles)
          if (props.projectId) {
            try {
              const profile = await resolveAutoBrandingProfile(props.projectId);

              if (profile) {
                hasResolvedProfile.value = true;
                console.log('[VodPresetEditor] Auto-pulling settings from profile:', profile.name);

                // Pull layout overlays
                if (profile.layout_overlays) {
                  try {
                    const overlays = JSON.parse(profile.layout_overlays) as LayoutOverlay[];
                    if (Array.isArray(overlays) && overlays.length > 0) {
                      layoutOverlays.value = overlays;
                      console.log('[VodPresetEditor] Loaded', overlays.length, 'overlay(s) from creator profile');
                    }
                  } catch (parseErr) {
                    console.warn('[VodPresetEditor] Failed to parse creator profile overlays:', parseErr);
                  }
                }

                // Pull watermark settings
                if (profile.watermark_settings) {
                  try {
                    const wmSettings = JSON.parse(profile.watermark_settings) as WatermarkSettings;
                    if (wmSettings) {
                      watermarkMode.value = 'custom';
                      customWatermarkSettings.value = wmSettings;
                      if (wmSettings.watermarkId) {
                        selectedCustomWatermarkId.value = wmSettings.watermarkId;
                      }
                      if (wmSettings.perRatioSettings) {
                        const prs = wmSettings.perRatioSettings;
                        customWatermarkPositionSettings.value = {
                          '16:9': prs['16:9'] ? { watermarkId: prs['16:9'].watermarkId, position: prs['16:9'].position } : null,
                          '9:16': prs['9:16'] ? { watermarkId: prs['9:16'].watermarkId, position: prs['9:16'].position } : null,
                          '1:1': prs['1:1'] ? { watermarkId: prs['1:1'].watermarkId, position: prs['1:1'].position } : null,
                          '4:5': prs['4:5'] ? { watermarkId: prs['4:5'].watermarkId, position: prs['4:5'].position } : null,
                        };
                      }
                      console.log('[VodPresetEditor] Loaded watermark settings from creator profile');
                    }
                  } catch (parseErr) {
                    console.warn('[VodPresetEditor] Failed to parse creator profile watermark settings:', parseErr);
                  }
                }

                const profileClipDefaults = parseCreatorClipBuildDefaults(profile.clip_build_defaults ?? null);
                if (profileClipDefaults?.subtitleDefaults) {
                  subtitleDefaults.value = JSON.parse(JSON.stringify(profileClipDefaults.subtitleDefaults));
                }
              } else {
                hasResolvedProfile.value = false;
                console.log('[VodPresetEditor] No applicable creator profile found for project:', props.projectId);
              }
            } catch (err) {
              console.warn('[VodPresetEditor] Failed to resolve creator profile:', err);
            }
          }
        }

        // Reset dropdown state
        showCustomWatermarkDropdown.value = false;

        // Load templates, overlay previews, and watermarks
        await loadTemplates();
        await loadOverlayPreviews();
        await loadCustomWatermarks();
      }
    },
    { immediate: true }
  );
</script>
