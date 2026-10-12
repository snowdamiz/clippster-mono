<template>
  <Modal
    :open="show && !showClipDefaultsEditor"
    :title="dialogTitle"
    :description="dialogDescription"
    :icon="formData.scope === 'global' ? Paintbrush : UserCircle"
    size="lg"
    flush
    class="h-[min(620px,calc(100vh-5rem))]"
    :dismissible="!saving"
    @close="closeDialog"
  >
    <!-- Section tabs -->
    <div class="sticky top-0 z-10 border-b border-line-subtle bg-surface-raised px-5 pb-3 pt-2">
      <SegmentedControl v-model="activeSection" :options="sectionOptions" />
    </div>

    <!-- Sections stay mounted (v-show); animate-enter restarts whenever one is shown again. -->
    <div class="px-5 py-4">
      <!-- ── Profile ─────────────────────────────────────────── -->
      <div v-show="activeSection === 'profile'" class="flex animate-enter flex-col gap-4">
        <Field label="Name" required>
          <Input
            v-model="formData.name"
            :placeholder="formData.scope === 'global' ? 'Branding profile name' : 'Creator name'"
          />
        </Field>
        <Field label="Description">
          <template #label-end><span class="text-2xs text-fg-subtle">Optional</span></template>
          <Textarea
            v-model="formData.description"
            rows="2"
            class="min-h-[60px] resize-none"
            :placeholder="
              formData.scope === 'global' ? 'e.g. Default branding for all content' : 'Brief description of this creator…'
            "
          />
        </Field>

        <div
          v-if="mode === 'local' && formData.scope !== 'global'"
          class="overflow-hidden rounded-lg border border-line-subtle bg-surface"
        >
          <SettingRow
            inset
            :icon="Disc"
            label="Personal profile for Clippster Studio"
            description="Use when recording in Studio. Applies the watermark live and intro/outro after recording ends."
          >
            <Switch
              :model-value="formData.scope === 'personal_studio'"
              @update:model-value="(v: boolean) => (formData.scope = v ? 'personal_studio' : 'streamer')"
            />
          </SettingRow>
          <SettingRow
            v-if="formData.scope === 'streamer'"
            inset
            :icon="HardDrive"
            label="Auto DVR"
            description="Automatically start DVR when this creator goes live."
          >
            <Switch v-model="formData.auto_dvr_enabled" />
          </SettingRow>
        </div>

        <!-- Platform links (not for global branding) -->
        <section v-if="formData.scope === 'streamer'" class="flex flex-col gap-2">
          <SectionHeader title="Platform links" :count="formData.platformLinks.length || undefined">
            <Button v-if="formData.platformLinks.length > 0" variant="ghost" size="xs" @click="addPlatformLink">
              <Plus /> Add platform
            </Button>
          </SectionHeader>

          <button
            v-if="formData.platformLinks.length === 0"
            type="button"
            class="flex flex-col items-center gap-1 rounded-lg border border-dashed border-line-strong px-4 py-5 text-center transition-colors hover:border-brand-line hover:bg-surface-hover"
            @click="addPlatformLink"
          >
            <span class="flex items-center gap-1.5 text-sm font-medium text-fg"><Plus class="size-4" /> Add platform</span>
            <span class="text-xs text-fg-muted">Link Kick, Twitch, YouTube, Rumble or PumpFun channels</span>
          </button>

          <div
            v-for="(link, index) in formData.platformLinks"
            :key="index"
            class="flex flex-col gap-3 rounded-lg border border-line-subtle bg-surface p-3"
          >
            <div class="flex items-center gap-2">
              <div
                class="grid size-8 shrink-0 place-items-center overflow-hidden rounded-full border border-line-subtle bg-surface-raised text-fg-subtle"
              >
                <img
                  v-if="link.profile_image_url"
                  :src="link.profile_image_url"
                  alt=""
                  class="size-full object-cover"
                  @error="(e) => ((e.target as HTMLImageElement).style.display = 'none')"
                />
                <Loader2
                  v-else-if="link.platform === 'pumpfun' && link.platform_id && fetchingProfileImage"
                  class="size-4 animate-spin"
                />
                <Users v-else class="size-4" />
              </div>

              <DropdownMenu
                :open="openPlatformDropdown === index"
                @update:open="(open: boolean) => (openPlatformDropdown = open ? index : null)"
              >
                <DropdownMenuTrigger as-child>
                  <button
                    type="button"
                    class="flex h-[var(--control-md)] min-w-0 items-center gap-2 rounded-[var(--radius-control)] border border-line bg-surface-raised pl-1.5 pr-2.5 text-sm text-fg transition-colors hover:border-line-strong data-[state=open]:border-line-strong"
                  >
                    <PlatformLogo :platform="link.platform" size="sm" />
                    <span class="truncate">{{ getPlatformName(link.platform) }}</span>
                    <ChevronDown class="size-3.5 shrink-0 text-fg-subtle" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" class="w-44">
                  <DropdownMenuItem
                    v-for="platform in availablePlatforms"
                    :key="platform.id"
                    :disabled="platform.disabled"
                    @select="selectPlatform(index, platform.id)"
                  >
                    <PlatformLogo :platform="platform.id" size="xs" />
                    <span class="flex-1">{{ platform.name }}</span>
                    <Badge v-if="platform.disabled">Soon</Badge>
                    <Check v-else-if="link.platform === platform.id" class="!text-brand" />
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <div class="ml-auto flex shrink-0 items-center gap-1">
                <Badge v-if="link.is_primary" variant="brand">Primary</Badge>
                <Button v-else variant="ghost" size="xs" @click="setPrimaryLink(index)">Set primary</Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="hover:text-danger"
                  title="Remove platform"
                  aria-label="Remove platform"
                  @click="removePlatformLink(index)"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>

            <div class="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field :label="link.platform === 'pumpfun' ? 'Mint ID or URL' : 'Channel slug or URL'" required>
                <Input
                  v-model="link.platform_id"
                  :placeholder="link.platform === 'pumpfun' ? 'Mint ID or PumpFun URL' : 'Channel slug or URL'"
                  @blur="extractPlatformId(link)"
                />
              </Field>
              <Field label="Display name">
                <Input v-model="link.display_name" placeholder="Optional" />
              </Field>
            </div>
          </div>
        </section>
      </div>

      <!-- ── Branding ────────────────────────────────────────── -->
      <div v-show="activeSection === 'branding'" class="flex animate-enter flex-col gap-4">
        <p class="text-xs text-fg-muted">
          {{
            formData.scope === 'global'
              ? 'Intro, outro and watermark applied to all content without a specific creator profile.'
              : "Default intro, outro and watermark for this creator's content."
          }}
        </p>

        <div
          v-if="isFreeTierUser"
          class="flex items-center gap-2 rounded-lg border border-[var(--warning-line)] bg-warning-soft px-3 py-2 text-xs font-medium text-warning"
        >
          <Lock class="size-3.5 shrink-0" />
          Custom assets require a paid plan
        </div>

        <div class="flex flex-col gap-4" :class="{ 'pointer-events-none opacity-40': isFreeTierUser }">
          <!-- Intro -->
          <Field label="Intro" :hint="hasIntroRatioConfig ? 'Per-ratio intros configured' : '16:9 aspect ratio'">
            <div class="flex items-center gap-1.5">
              <AssetSelect
                :model-value="formData.intro_id"
                :options="introAssets"
                :icon="Play"
                none-label="No intro"
                :disabled="uploadingIntro"
                class="flex-1"
                @update:model-value="selectIntro"
              />
              <Button
                variant="secondary"
                size="icon"
                :class="hasIntroRatioConfig && 'border-brand-line text-brand'"
                title="Configure intro per aspect ratio"
                aria-label="Configure intro per aspect ratio"
                @click="openRatioPicker('intro')"
              >
                <Settings2 />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                :loading="uploadingIntro"
                title="Upload new intro"
                aria-label="Upload new intro"
                @click="handleIntroUploadClick"
              >
                <Upload v-if="!uploadingIntro" />
              </Button>
            </div>
          </Field>

          <!-- Outro -->
          <Field label="Outro" :hint="hasOutroRatioConfig ? 'Per-ratio outros configured' : '16:9 aspect ratio'">
            <div class="flex items-center gap-1.5">
              <AssetSelect
                :model-value="formData.outro_id"
                :options="outroAssets"
                :icon="SkipForward"
                none-label="No outro"
                :disabled="uploadingOutro"
                class="flex-1"
                @update:model-value="selectOutro"
              />
              <Button
                variant="secondary"
                size="icon"
                :class="hasOutroRatioConfig && 'border-brand-line text-brand'"
                title="Configure outro per aspect ratio"
                aria-label="Configure outro per aspect ratio"
                @click="openRatioPicker('outro')"
              >
                <Settings2 />
              </Button>
              <Button
                variant="secondary"
                size="icon"
                :loading="uploadingOutro"
                title="Upload new outro"
                aria-label="Upload new outro"
                @click="handleOutroUploadClick"
              >
                <Upload v-if="!uploadingOutro" />
              </Button>
            </div>
          </Field>

          <!-- Watermark -->
          <Field
            label="Watermark"
            :hint="
              formData.watermark_settings
                ? `Position configured for ${getConfiguredRatiosCount()} aspect ratio(s)`
                : undefined
            "
          >
            <div class="flex items-center gap-1.5">
              <AssetSelect
                :model-value="formData.watermark_id"
                :options="watermarkAssets"
                :icon="Image"
                none-label="No watermark"
                :disabled="uploadingWatermark"
                class="flex-1"
                @update:model-value="selectWatermark"
              />
              <Button
                variant="secondary"
                size="icon"
                :disabled="!formData.watermark_id"
                :class="formData.watermark_settings && 'border-brand-line text-brand'"
                title="Configure watermark position"
                aria-label="Configure watermark position"
                @click="openWatermarkPositionPicker"
              >
                <Settings2 />
              </Button>
              <input
                ref="watermarkFileInput"
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                class="hidden"
                @change="handleWatermarkUpload"
              />
              <Button
                variant="secondary"
                size="icon"
                :loading="uploadingWatermark"
                title="Upload new watermark"
                aria-label="Upload new watermark"
                @click="props.mode === 'local' ? handleWatermarkUploadLocal() : watermarkFileInput?.click()"
              >
                <Upload v-if="!uploadingWatermark" />
              </Button>
            </div>
          </Field>

          <!-- Layout overlays -->
          <Field
            label="Layout overlays"
            :hint="
              formData.layout_overlays.length > 0
                ? `${totalOverlayRatios} aspect ratio(s) configured across ${formData.layout_overlays.length} overlay(s)`
                : 'Border images, dividers or decorative frames placed over clips'
            "
          >
            <template #label-end>
              <Button variant="ghost" size="xs" :loading="uploadingOverlay" @click="addLayoutOverlay">
                <Upload v-if="!uploadingOverlay" /> Upload overlay
              </Button>
            </template>
            <div
              v-if="formData.layout_overlays.length > 0"
              class="divide-y divide-line-subtle overflow-hidden rounded-lg border border-line-subtle bg-surface"
            >
              <OverlayRow
                v-for="(overlay, idx) in formData.layout_overlays"
                :key="overlay.id"
                v-model:label="overlay.label"
                :preview-url="overlayPreviews[overlay.id]"
                :placeholder="`Overlay ${idx + 1}`"
              >
                <template #meta>
                  {{ overlay.opacity }}% opacity
                  <template v-if="overlayConfiguredRatioCount(overlay) > 0">
                    · {{ overlayConfiguredRatioCount(overlay) }}/4 ratios
                  </template>
                </template>
                <template #actions>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    :class="overlayConfiguredRatioCount(overlay) > 0 && 'text-brand'"
                    title="Configure position per aspect ratio"
                    aria-label="Configure position per aspect ratio"
                    @click="openOverlayPositionPicker(idx)"
                  >
                    <Settings2 />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="hover:text-danger"
                    title="Remove overlay"
                    aria-label="Remove overlay"
                    @click="removeLayoutOverlay(idx)"
                  >
                    <Trash2 />
                  </Button>
                </template>
              </OverlayRow>
            </div>
          </Field>
        </div>
      </div>

      <!-- ── Clip defaults ───────────────────────────────────── -->
      <div v-if="hasClipDefaultsSection" v-show="activeSection === 'defaults'" class="flex animate-enter flex-col gap-4">
        <p class="text-xs text-fg-muted">
          Framing, layout and subtitle style this creator usually needs. When downloading a VOD for them, tick
          “Use creator layout” to start every project pre-configured with these defaults.
        </p>

        <Field
          label="Default output ratio"
          :hint="`Matches the framing editor · source frame ${formData.clip_build_defaults.sourceAspectRatio}`"
        >
          <SegmentedControl
            :model-value="formData.clip_build_defaults.targetAspectRatio"
            :options="clipRatioOptions"
            class="self-start"
            @update:model-value="setClipDefaultRatio"
          />
        </Field>

        <Field label="Reference image" hint="Used to align crop regions on the canvas, like the framing editor upload.">
          <div class="flex flex-wrap items-center gap-1.5">
            <Button variant="secondary" size="sm" @click="pickReferenceImageUpload">
              <Upload />
              {{ formData.clip_build_defaults.referenceImageSource === 'upload' ? 'Replace screenshot' : 'Upload screenshot' }}
            </Button>
            <Button
              v-if="formData.clip_build_defaults.referenceImageSource !== 'none'"
              variant="ghost"
              size="sm"
              @click="setReferenceSource('none')"
            >
              No image
            </Button>
          </div>
          <div
            v-if="resolvedReferenceImageUrl"
            class="mt-1 overflow-hidden rounded-lg border border-line-subtle bg-surface-sunken"
          >
            <img
              :src="resolvedReferenceImageUrl"
              alt="Reference frame preview"
              class="max-h-40 w-full object-contain"
              @error="onReferenceImageError"
            />
          </div>
          <p
            v-else-if="formData.clip_build_defaults.referenceImageSource !== 'none'"
            class="flex items-center gap-1.5 text-xs text-warning"
          >
            <AlertCircle class="size-3.5" /> No reference image yet. Upload a screenshot above.
          </p>
        </Field>

        <SettingRow
          :icon="Layers"
          label="Layout & subtitles"
          :description="hasClipDefaultsConfig ? clipDefaultsSummary : 'Crop regions and subtitle style'"
        >
          <Button variant="secondary" size="sm" @click="openClipDefaultsEditor">
            {{ hasClipDefaultsConfig ? 'Edit' : 'Configure' }}
          </Button>
        </SettingRow>
      </div>
    </div>

    <template #footer>
      <Button variant="ghost" :disabled="saving" @click="closeDialog">Cancel</Button>
      <Button
        variant="primary"
        :loading="saving || fetchingProfileImage"
        :disabled="!isValid"
        @click="handleSubmit"
      >
        {{ submitLabel }}
      </Button>
    </template>
  </Modal>

  <!-- Watermark Position Picker -->
  <WatermarkPositionPicker
    :show="showWatermarkPositionPicker"
    :watermark-url="mode === 'organization' ? selectedWatermarkAsset?.url : undefined"
    :watermark-file-path="mode === 'local' ? selectedWatermarkFilePath : undefined"
    :watermark-id="selectedWatermarkId"
    :watermark-width="selectedWatermarkDimensions.width"
    :watermark-height="selectedWatermarkDimensions.height"
    :settings="formData.watermark_settings || undefined"
    :overlays="formData.layout_overlays"
    :overlay-previews="overlayPreviews"
    :org-assets="mode === 'organization' ? orgAssets : undefined"
    @close="showWatermarkPositionPicker = false"
    @save="handleWatermarkSettingsSave"
  />

  <!-- Overlay Position Picker -->
  <OverlayPositionPicker
    :show="showOverlayPositionPicker"
    :overlay-image-path="activeOverlayForPosition?.imagePath || ''"
    :overlay-image-url="activeOverlayForPosition ? overlayPreviews[activeOverlayForPosition.id] : ''"
    :overlay-label="activeOverlayForPosition?.label || ''"
    :settings="activeOverlayForPosition?.perRatioSettings || undefined"
    :watermark-settings="formData.watermark_settings"
    :watermark-url="mode === 'organization' ? selectedWatermarkAsset?.url : undefined"
    :watermark-file-path="mode === 'local' ? selectedWatermarkFilePath : undefined"
    :org-assets="orgAssets"
    @close="showOverlayPositionPicker = false"
    @save="handleOverlayPositionSave"
  />

  <!-- Intro/Outro Ratio Picker -->
  <IntroOutroRatioPicker
    :show="showIntroOutroRatioPicker"
    :mode="ratioPickerMode"
    :initial-settings="getInitialRatioSettings(ratioPickerMode)"
    @update:show="showIntroOutroRatioPicker = $event"
    @save="handleRatioSettingsSave"
    @close="showIntroOutroRatioPicker = false"
  />

  <!-- Creator profile clip-defaults editor (slim Manual POI fork) -->
  <CreatorProfileFramingEditor
    v-model="showClipDefaultsEditor"
    :initial-framing="formData.clip_build_defaults.framingConfig"
    :initial-subtitle="formData.clip_build_defaults.subtitleDefaults"
    :target-aspect-ratio="formData.clip_build_defaults.targetAspectRatio"
    :source-aspect-ratio="formData.clip_build_defaults.sourceAspectRatio"
    :reference-image-url="resolvedReferenceImageUrl"
    @confirm="handleClipDefaultsConfirm"
  />
</template>

<script setup lang="ts">
  import { ref, computed, watch, onUnmounted } from 'vue';
  import {
    AlertCircle,
    Check,
    ChevronDown,
    Disc,
    HardDrive,
    Image,
    Layers,
    Loader2,
    Lock,
    Paintbrush,
    Play,
    Plus,
    Settings2,
    SkipForward,
    Trash2,
    Upload,
    UserCircle,
    Users,
  } from 'lucide-vue-next';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
  } from '@/components/ui/dropdown-menu';
  import { Field } from '@/components/ui/field';
  import { SettingRow } from '@/components/ui/setting-row';
  import { Input } from '@/components/ui/input';
  import { Modal } from '@/components/ui/modal';
  import { PlatformLogo, platformLabel } from '@/components/ui/platform-logo';
  import { SectionHeader } from '@/components/ui/section-header';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Switch } from '@/components/ui/switch';
  import { Textarea } from '@/components/ui/textarea';
  import AssetSelect from './creators/AssetSelect.vue';
  import OverlayRow from './branding/OverlayRow.vue';
  import {
    createOrganizationCreatorProfile,
    updateOrganizationCreatorProfile,
    addPlatformLink as apiAddPlatformLink,
    deletePlatformLink as apiDeletePlatformLink,
    type ServerOrganizationCreatorProfile,
  } from '@/services/organizationProfilesApi';
  import {
    listOrganizationAssets,
    uploadOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import {
    createCreatorProfile,
    updateCreatorProfile,
    addPlatformLink as dbAddPlatformLink,
    deletePlatformLink as dbDeletePlatformLink,
    updatePlatformLink as dbUpdatePlatformLink,
    getAllIntroOutros,
    createMonitoredStreamer,
    getMonitoredStreamerByMint,
    type CreatorProfileWithLinks,
    type IntroOutro,
  } from '@/services/database';
  import { getAllWatermarkImages, type WatermarkImage } from '@/services/database/watermarks';
  import { extractMintId, searchPumpFunTokens, fetchTokenMetadataFromServer } from '@/services/pumpfun';
  import { extractChannelSlug, checkKickLivestream } from '@/services/kick';
  import { extractChannelName, checkTwitchLivestream } from '@/services/twitch';
  import { extractYouTubeChannel, getYouTubeChannelInfo } from '@/services/youtube';
  import { extractRumbleChannel, getRumbleChannelInfo } from '@/services/rumble';
  import { readFile } from '@tauri-apps/plugin-fs';
  import { useToast } from '@/composables/useToast';
  import { useAssetOperations } from '@/composables/useAssetOperations';
  import { useWatermarkOperations } from '@/composables/useWatermarkOperations';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from './WatermarkPositionPicker.vue';
  import OverlayPositionPicker from './OverlayPositionPicker.vue';
  import IntroOutroRatioPicker from './IntroOutroRatioPicker.vue';
  import CreatorProfileFramingEditor from './poi/CreatorProfileFramingEditor.vue';
  import type { CreatorPlatformLink, RatioAssetMap } from '@/services/database/types';
  import type {
    CreatorClipBuildDefaults,
    CreatorReferenceImageSource,
    LayoutOverlay,
    ManualFramingConfig,
    PerRatioOverlaySettings,
    SubtitleSettings,
  } from '@/types';
  import {
    SUPPORTED_TARGET_ASPECT_RATIOS,
    parseCreatorClipBuildDefaults,
    serializeCreatorClipBuildDefaults,
  } from '@/composables/useCreatorClipDefaults';
  import { invoke, convertFileSrc } from '@tauri-apps/api/core';
  import { open as openFileDialog } from '@tauri-apps/plugin-dialog';
  import { useAuthStore } from '@/stores/auth';
  import { useSubscription } from '@/composables/useSubscription';

  type PlatformId = 'pumpfun' | 'kick' | 'twitch' | 'youtube' | 'rumble';

  interface PlatformLinkInput {
    platform: PlatformId;
    platform_id: string;
    display_name: string;
    profile_image_url?: string;
    is_primary: boolean;
    id?: number | string; // Present if existing link
    isNew?: boolean;
    monitored_streamer_id?: string | null;
  }

  /** Maps UI picker ids (`youtube`) to SQLite creator_platform_links.platform (`YouTube`). */
  function platformInputToDb(platform: PlatformId): CreatorPlatformLink['platform'] {
    return platform === 'youtube' ? 'YouTube' : platform;
  }

  // Unified asset type for both modes
  interface AssetItem {
    id: number | string;
    name: string;
    url?: string;
    file_path?: string;
    width?: number | null;
    height?: number | null;
  }

  interface Props {
    show: boolean;
    mode: 'organization' | 'local';
    // Organization mode props
    organizationId?: string | number;
    profile?: ServerOrganizationCreatorProfile | null;
    // Local mode props
    creator?: CreatorProfileWithLinks | null;
    // Scope for new profiles ('streamer' or 'global')
    scope?: 'streamer' | 'global' | 'personal_studio';
  }

  const props = defineProps<Props>();
  const emit = defineEmits<{
    (e: 'close'): void;
    (e: 'saved', profile?: ServerOrganizationCreatorProfile): void;
  }>();

  const { success: showSuccess, error: showError } = useToast();

  // Free tier detection — refresh subscription from server when dialog opens
  // so admin-granted subscriptions are recognized without re-login
  const authStoreForTier = useAuthStore();
  const { fetchSubscriptionStatus } = useSubscription();
  watch(() => props.show, (isOpen) => {
    if (isOpen) fetchSubscriptionStatus();
  });
  const isFreeTierUser = computed(() => {
    if (props.mode === 'organization') return false; // org mode doesn't apply
    const user = authStoreForTier.user;
    if (!user) return false;
    if (user.is_admin) return false;
    if (user.created_by_organization_id) return false;
    const status = (user as any).subscription_status;
    return !status || status === 'none' || status === 'expired';
  });

  // Asset operations for local mode
  const { uploadAsset: uploadVideoAsset, onUploadComplete } = useAssetOperations();
  const { uploadWatermark } = useWatermarkOperations();
  const pendingUploadType = ref<'intro' | 'outro' | null>(null);

  const saving = ref(false);
  const fetchingProfileImage = ref(false);

  // Assets storage
  const orgAssets = ref<ServerOrganizationAsset[]>([]);
  const localIntros = ref<IntroOutro[]>([]);
  const localOutros = ref<IntroOutro[]>([]);
  const localWatermarks = ref<WatermarkImage[]>([]);

  // Dropdown state
  const openPlatformDropdown = ref<number | null>(null);
  const openAssetDropdown = ref<'intro' | 'outro' | 'watermark' | null>(null);

  // Upload state
  const watermarkFileInput = ref<HTMLInputElement | null>(null);
  const uploadingIntro = ref(false);
  const uploadingOutro = ref(false);
  const uploadingWatermark = ref(false);

  // Available platforms
  const availablePlatforms = [
    { id: 'pumpfun' as PlatformId, name: 'PumpFun', disabled: false },
    { id: 'kick' as PlatformId, name: 'Kick', disabled: false },
    { id: 'twitch' as PlatformId, name: 'Twitch', disabled: false },
    { id: 'youtube' as PlatformId, name: 'YouTube', disabled: false },
    { id: 'rumble' as PlatformId, name: 'Rumble', disabled: false },
  ];

  const CLIP_DEFAULT_RATIO_OPTIONS = SUPPORTED_TARGET_ASPECT_RATIOS;

  function createEmptyClipBuildDefaults(): CreatorClipBuildDefaults {
    return {
      targetAspectRatio: '9:16',
      framingConfig: null,
      layoutOverlays: [],
      watermarkMode: 'creator',
      customWatermarkSettings: null,
      subtitleDefaults: null,
      referenceImageSource: 'none',
      referenceImageUrl: null,
      sourceAspectRatio: '16:9',
    };
  }

  const formData = ref<{
    name: string;
    description: string;
    intro_id: number | string | null;
    outro_id: number | string | null;
    watermark_id: number | string | null;
    watermark_settings: CreatorWatermarkSettings | null;
    intro_outro_settings: string | null;
    intro_ratio_settings: string | null;
    outro_ratio_settings: string | null;
    layout_overlays: LayoutOverlay[];
    platformLinks: PlatformLinkInput[];
    auto_dvr_enabled: boolean;
    scope: 'streamer' | 'global' | 'personal_studio';
    clip_build_defaults: CreatorClipBuildDefaults;
  }>({
    name: '',
    description: '',
    intro_id: null,
    outro_id: null,
    watermark_id: null,
    watermark_settings: null,
    intro_outro_settings: null,
    intro_ratio_settings: null,
    outro_ratio_settings: null,
    layout_overlays: [],
    platformLinks: [],
    auto_dvr_enabled: false,
    scope: 'streamer',
    clip_build_defaults: createEmptyClipBuildDefaults(),
  });

  // Clip defaults editor state
  const showClipDefaultsEditor = ref(false);

  // Resolve a renderable URL for the chosen reference image source.
  // Local file paths get run through Tauri's convertFileSrc so the webview can load them.
  const resolvedReferenceImageUrl = computed<string | null>(() => {
    const cd = formData.value.clip_build_defaults;
    if (!cd.referenceImageUrl) return null;
    if (cd.referenceImageUrl.startsWith('http://') || cd.referenceImageUrl.startsWith('https://')) {
      return cd.referenceImageUrl;
    }
    try {
      return convertFileSrc(cd.referenceImageUrl);
    } catch {
      return cd.referenceImageUrl;
    }
  });

  const hasClipDefaultsConfig = computed(() => {
    const cd = formData.value.clip_build_defaults;
    return Boolean(cd.framingConfig || cd.subtitleDefaults);
  });

  const clipDefaultsSummary = computed(() => {
    const cd = formData.value.clip_build_defaults;
    const parts: string[] = [];
    if (cd.framingConfig) {
      const regionCount = cd.framingConfig.regions?.length ?? 0;
      parts.push(`${regionCount} region${regionCount === 1 ? '' : 's'}`);
    }
    if (cd.subtitleDefaults) {
      parts.push(`subtitles: ${cd.subtitleDefaults.animationStyle}`);
    }
    return parts.length ? parts.join(' · ') : 'Configured';
  });

  function setClipDefaultRatio(ratio: string) {
    formData.value.clip_build_defaults = {
      ...formData.value.clip_build_defaults,
      targetAspectRatio: ratio,
      framingConfig: formData.value.clip_build_defaults.framingConfig
        ? { ...formData.value.clip_build_defaults.framingConfig, targetAspectRatio: ratio }
        : null,
    };
  }

  function setReferenceSource(source: CreatorReferenceImageSource) {
    formData.value.clip_build_defaults = {
      ...formData.value.clip_build_defaults,
      referenceImageSource: source,
      referenceImageUrl: source === 'none' ? null : formData.value.clip_build_defaults.referenceImageUrl,
      capturedAt: source === 'none' ? undefined : Date.now(),
    };
  }

  async function pickReferenceImageUpload() {
    try {
      const selected = await openFileDialog({
        multiple: false,
        directory: false,
        filters: [{ name: 'Image', extensions: ['png', 'jpg', 'jpeg', 'webp'] }],
      });
      if (!selected || Array.isArray(selected)) return;

      // Same Rust storage root as watermarks (%LOCALAPPDATA%\Clippster\…), not appLocalDataDir().
      const { destination_path } = await invoke<{ destination_path: string }>(
        'copy_creator_reference_frame_to_storage',
        { sourcePath: selected },
      );

      formData.value.clip_build_defaults = {
        ...formData.value.clip_build_defaults,
        referenceImageSource: 'upload',
        referenceImageUrl: destination_path,
        capturedAt: Date.now(),
      };
    } catch (err) {
      console.error('[ProfileDialog] Failed to pick reference image:', err);
      showError('Upload Failed', err instanceof Error ? err.message : 'Could not save image');
    }
  }

  function onReferenceImageError() {
    console.warn('[ProfileDialog] Reference image failed to load.');
  }

  function openClipDefaultsEditor() {
    showClipDefaultsEditor.value = true;
  }

  function handleClipDefaultsConfirm(payload: {
    framing: ManualFramingConfig;
    subtitle: SubtitleSettings;
  }) {
    formData.value.clip_build_defaults = {
      ...formData.value.clip_build_defaults,
      targetAspectRatio: payload.framing.targetAspectRatio,
      framingConfig: payload.framing,
      subtitleDefaults: payload.subtitle,
    };
  }

  // Watermark position picker state
  const showWatermarkPositionPicker = ref(false);

  // Overlay state
  const overlayPreviews = ref<Record<string, string>>({});
  const showOverlayDropdown = ref(false);
  const showOverlayPositionPicker = ref(false);
  const activeOverlayIndex = ref(-1);
  const uploadingOverlay = ref(false);

  const activeOverlayForPosition = computed(() => {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= formData.value.layout_overlays.length) return null;
    return formData.value.layout_overlays[activeOverlayIndex.value];
  });

  function overlayConfiguredRatioCount(overlay: LayoutOverlay): number {
    if (!overlay.perRatioSettings) return 0;
    const s = overlay.perRatioSettings;
    return [s['16:9'], s['9:16'], s['1:1'], s['4:5']].filter((v) => v !== null && v !== undefined).length;
  }

  const totalOverlayRatios = computed(() => {
    return formData.value.layout_overlays.reduce((sum, o) => sum + overlayConfiguredRatioCount(o), 0);
  });

  // Intro/Outro ratio picker state
  const showIntroOutroRatioPicker = ref(false);
  const ratioPickerMode = ref<'intro' | 'outro'>('intro');

  // Computed assets based on mode
  const introAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'intro')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localIntros.value.map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));
  });

  const outroAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'outro')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localOutros.value.map((a) => ({ id: a.id, name: a.name, file_path: a.file_path }));
  });

  const watermarkAssets = computed<AssetItem[]>(() => {
    if (props.mode === 'organization') {
      return orgAssets.value
        .filter((a) => a.asset_type === 'watermark')
        .map((a) => ({ id: a.id, name: a.name, url: a.url, width: a.width, height: a.height }));
    }
    return localWatermarks.value.map((a) => ({
      id: a.id,
      name: a.name,
      file_path: a.file_path,
      width: a.width,
      height: a.height,
    }));
  });

  // Get selected watermark asset for position picker
  const selectedWatermarkAsset = computed(() => {
    if (!formData.value.watermark_id) return null;
    if (props.mode === 'organization') {
      return orgAssets.value.find((a) => a.id === formData.value.watermark_id) || null;
    }
    return null;
  });

  const selectedWatermarkFilePath = computed(() => {
    if (!formData.value.watermark_id || props.mode !== 'local') return undefined;
    const wm = localWatermarks.value.find((w) => w.id === formData.value.watermark_id);
    return wm?.file_path;
  });

  const selectedWatermarkId = computed(() => {
    if (!formData.value.watermark_id) return undefined;
    return String(formData.value.watermark_id);
  });

  const selectedWatermarkDimensions = computed(() => {
    if (!formData.value.watermark_id) return { width: null, height: null };
    if (props.mode === 'organization') {
      const asset = orgAssets.value.find((a) => a.id === formData.value.watermark_id);
      return { width: asset?.width ?? null, height: asset?.height ?? null };
    }
    const wm = localWatermarks.value.find((w) => w.id === formData.value.watermark_id);
    return { width: wm?.width ?? null, height: wm?.height ?? null };
  });

  const isEditing = computed(() => {
    return props.mode === 'organization' ? !!props.profile : !!props.creator;
  });

  // ── Dialog chrome ───────────────────────────────────────
  type DialogSection = 'profile' | 'branding' | 'defaults';
  const activeSection = ref<DialogSection>('profile');

  const hasClipDefaultsSection = computed(() => props.mode === 'local' && formData.value.scope === 'streamer');

  const sectionOptions = computed<SegmentedOption<DialogSection>[]>(() => {
    const options: SegmentedOption<DialogSection>[] = [
      { value: 'profile', label: formData.value.scope === 'global' ? 'Details' : 'Profile', icon: UserCircle },
      { value: 'branding', label: 'Branding', icon: Paintbrush },
    ];
    if (hasClipDefaultsSection.value) {
      options.push({ value: 'defaults', label: 'Clip defaults', icon: Layers });
    }
    return options;
  });

  watch(hasClipDefaultsSection, (available) => {
    if (!available && activeSection.value === 'defaults') activeSection.value = 'profile';
  });

  watch(
    () => props.show,
    (isOpen) => {
      if (isOpen) activeSection.value = 'profile';
    }
  );

  const clipRatioOptions = computed<SegmentedOption<string>[]>(() =>
    CLIP_DEFAULT_RATIO_OPTIONS.map((ratio) => ({ value: ratio, label: ratio }))
  );

  const dialogTitle = computed(() => {
    if (formData.value.scope === 'global') return isEditing.value ? 'Edit global branding' : 'Create global branding';
    return isEditing.value ? 'Edit creator profile' : 'Create creator profile';
  });

  const dialogDescription = computed(() => {
    if (formData.value.scope === 'global') {
      return isEditing.value
        ? 'Update default branding applied to content without a creator profile.'
        : 'Set the default intro, outro and watermark for content without a specific creator profile.';
    }
    return isEditing.value ? 'Update profile details and platform links.' : 'Add a new creator with platform connections.';
  });

  const submitLabel = computed(() => {
    if (saving.value) return 'Saving…';
    if (fetchingProfileImage.value) return 'Fetching info…';
    if (formData.value.scope === 'global') return isEditing.value ? 'Update branding' : 'Create branding';
    return isEditing.value ? 'Update profile' : 'Create profile';
  });

  const isValid = computed(() => {
    if (!formData.value.name.trim()) return false;
    // Platform links are now optional for local mode
    // Users can create profiles with just assets (intro/outro/watermark) for local video projects
    return true;
  });

  watch(
    () => props.show,
    async (newVal) => {
      if (newVal) {
        openPlatformDropdown.value = null;
        openAssetDropdown.value = null;
        showWatermarkPositionPicker.value = false;

        // Load assets based on mode
        if (props.mode === 'organization' && props.organizationId) {
          const response = await listOrganizationAssets(props.organizationId);
          if (response.success) {
            orgAssets.value = response.assets;
          }
        } else if (props.mode === 'local') {
          await loadLocalAssets();
        }

        // Reset or populate form
        if (props.mode === 'organization' && props.profile) {
          formData.value = {
            name: props.profile.name,
            description: props.profile.description || '',
            intro_id: props.profile.intro_id ?? null,
            outro_id: props.profile.outro_id ?? null,
            watermark_id: props.profile.watermark_id ?? null,
            watermark_settings: (props.profile.watermark_settings as unknown as CreatorWatermarkSettings) || null,
            intro_outro_settings: (props.profile as any).intro_outro_settings || null,
            intro_ratio_settings: (props.profile as any).intro_ratio_settings || null,
            outro_ratio_settings: (props.profile as any).outro_ratio_settings || null,
            layout_overlays: (props.profile.layout_overlays as unknown as LayoutOverlay[]) || [],
            auto_dvr_enabled: Boolean((props.profile as any).auto_dvr_enabled),
            scope: ((props.profile as any).scope as 'streamer' | 'global' | 'personal_studio') || props.scope || 'streamer',
            platformLinks: props.profile.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform as PlatformId,
              platform_id: link.platform_id,
              display_name: link.display_name || '',
              profile_image_url: link.profile_image_url || '',
              is_primary: link.is_primary,
              isNew: false,
              monitored_streamer_id: null,
            })),
            // Org profiles do not support clip-build defaults — keep empty defaults so the
            // form is well-formed even when this section is hidden.
            clip_build_defaults: createEmptyClipBuildDefaults(),
          };
        } else if (props.mode === 'local' && props.creator) {
          formData.value = {
            name: props.creator.name,
            description: props.creator.description || '',
            intro_id: props.creator.intro_id,
            outro_id: props.creator.outro_id,
            watermark_id: props.creator.watermark_id,
            watermark_settings: props.creator.watermark_settings ? JSON.parse(props.creator.watermark_settings) : null,
            intro_outro_settings: props.creator.intro_outro_settings || null,
            intro_ratio_settings: props.creator.intro_ratio_settings || null,
            outro_ratio_settings: props.creator.outro_ratio_settings || null,
            layout_overlays: props.creator.layout_overlays ? JSON.parse(props.creator.layout_overlays) : [],
            auto_dvr_enabled: Boolean((props.creator as any).auto_dvr_enabled),
            scope: props.creator.scope || props.scope || 'streamer',
            platformLinks: props.creator.platform_links.map((link) => ({
              id: link.id,
              platform: link.platform as PlatformId,
              platform_id: link.platform_id,
              display_name: link.display_name || '',
              profile_image_url: link.profile_image_url || '',
              is_primary: Boolean(link.is_primary),
              isNew: false,
              monitored_streamer_id: link.monitored_streamer_id,
            })),
            clip_build_defaults:
              parseCreatorClipBuildDefaults(props.creator.clip_build_defaults ?? null) ??
              createEmptyClipBuildDefaults(),
          };
        } else {
          formData.value = {
            name: '',
            description: '',
            intro_id: null,
            outro_id: null,
            watermark_id: null,
            watermark_settings: null,
            intro_outro_settings: null,
            intro_ratio_settings: null,
            outro_ratio_settings: null,
            layout_overlays: [],
            platformLinks: [],
            auto_dvr_enabled: false,
            scope: props.scope || 'streamer',
            clip_build_defaults: createEmptyClipBuildDefaults(),
          };
        }

        // Load overlay previews
        await loadAllOverlayPreviews();
      }
    }
  );

  async function loadLocalAssets() {
    try {
      const allAssets = await getAllIntroOutros();
      localIntros.value = allAssets.filter((a) => a.type === 'intro');
      localOutros.value = allAssets.filter((a) => a.type === 'outro');
      localWatermarks.value = await getAllWatermarkImages();
    } catch (err) {
      console.error('Failed to load local assets:', err);
    }
  }

  function closeDialog() {
    if (!saving.value) {
      emit('close');
    }
  }

  // ============================================
  // Platform Link Functions
  // ============================================

  function addPlatformLink() {
    formData.value.platformLinks.push({
      platform: 'pumpfun',
      platform_id: '',
      display_name: '',
      is_primary: formData.value.platformLinks.length === 0,
      isNew: true,
    });
  }

  function removePlatformLink(index: number) {
    const removed = formData.value.platformLinks.splice(index, 1)[0];
    // If we removed the primary, set first remaining as primary
    if (removed.is_primary && formData.value.platformLinks.length > 0) {
      formData.value.platformLinks[0].is_primary = true;
    }
  }

  function setPrimaryLink(index: number) {
    formData.value.platformLinks.forEach((link, i) => {
      link.is_primary = i === index;
    });
  }

  function togglePlatformDropdown(index: number) {
    openPlatformDropdown.value = openPlatformDropdown.value === index ? null : index;
  }

  async function selectPlatform(index: number, platformId: PlatformId) {
    const link = formData.value.platformLinks[index];
    link.platform = platformId;
    openPlatformDropdown.value = null;

    // If switching platforms and we have a platform ID, extract metadata
    if ((platformId === 'pumpfun' || platformId === 'kick' || platformId === 'twitch' || platformId === 'youtube' || platformId === 'rumble') && link.platform_id.trim()) {
      await extractPlatformId(link);
    }
  }

  async function extractPlatformId(link: PlatformLinkInput) {
    const input = link.platform_id.trim();
    if (!input) return;

    if (link.platform === 'pumpfun') {
      const mintId = extractMintId(input);
      if (mintId) {
        link.platform_id = mintId;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from DexScreener/Metaplex
        fetchingProfileImage.value = true;
        try {
          let match = null;

          // 1. Try DexScreener search first
          const results = await searchPumpFunTokens(mintId);
          if (results && results.length > 0) {
            match = results.find((r) => r.mint === mintId) || results[0];
          }

          // 2. Fallback to server (Metaplex) if no match or missing image
          if (!match || !match.image) {
            const serverMeta = await fetchTokenMetadataFromServer(mintId);
            if (serverMeta) {
              match = serverMeta;
            }
          }

          if (match) {
            // Update display name if not already set
            if (!link.display_name) {
              link.display_name = match.symbol || match.name || '';
            }
            // Store the profile image URL
            link.profile_image_url = match.image || '';
          }
        } catch (e) {
          console.warn('Failed to fetch PumpFun metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'kick') {
      const slug = extractChannelSlug(input);
      if (slug) {
        link.platform_id = slug;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from Kick API
        fetchingProfileImage.value = true;
        try {
          const status = await checkKickLivestream(slug);
          if (status) {
            // Update display name if not already set
            if (!link.display_name && status.username) {
              link.display_name = status.username;
            }
            // Store the profile image URL
            if (status.profileImageUrl) {
              link.profile_image_url = status.profileImageUrl;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch Kick channel metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'twitch') {
      const channelName = extractChannelName(input);
      if (channelName) {
        link.platform_id = channelName;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from Twitch API
        fetchingProfileImage.value = true;
        try {
          const status = await checkTwitchLivestream(channelName);
          if (status) {
            // Update display name if not already set
            if (!link.display_name && status.displayName) {
              link.display_name = status.displayName;
            }
            // Store the profile image URL
            if (status.profileImageUrl) {
              link.profile_image_url = status.profileImageUrl;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch Twitch channel metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'youtube') {
      const channelId = extractYouTubeChannel(input);
      if (channelId) {
        link.platform_id = channelId;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from YouTube via Tauri command
        fetchingProfileImage.value = true;
        try {
          const channelInfo = await getYouTubeChannelInfo(channelId);
          if (channelInfo) {
            // Update display name if not already set
            const displayName = channelInfo.displayName || channelInfo.channelName;
            if (!link.display_name && displayName) {
              link.display_name = displayName;
            }
            // Store the profile image URL
            if (channelInfo.profileImageUrl) {
              link.profile_image_url = channelInfo.profileImageUrl;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch YouTube channel metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    } else if (link.platform === 'rumble') {
      const channelName = extractRumbleChannel(input);
      if (channelName) {
        link.platform_id = channelName;

        // Check if we already have a profile image from another link
        const existingProfileImage = formData.value.platformLinks.find(
          (l) => l !== link && l.profile_image_url
        )?.profile_image_url;

        if (existingProfileImage) {
          link.profile_image_url = existingProfileImage;
          return;
        }

        // Fetch profile image from Rumble via Tauri command
        fetchingProfileImage.value = true;
        try {
          const channelInfo = await getRumbleChannelInfo(channelName);
          if (channelInfo) {
            // Update display name if not already set
            const displayName = channelInfo.displayName || channelInfo.channelName;
            if (!link.display_name && displayName) {
              link.display_name = displayName;
            }
            // Store the profile image URL
            if (channelInfo.profileImageUrl) {
              link.profile_image_url = channelInfo.profileImageUrl;
            }
          }
        } catch (e) {
          console.warn('Failed to fetch Rumble channel metadata:', e);
        } finally {
          fetchingProfileImage.value = false;
        }
      }
    }
  }

  // ============================================
  // Platform Helpers
  // ============================================

  function getPlatformName(platform: string): string {
    return platformLabel(platform);
  }

  // ============================================
  // Asset Dropdown Functions
  // ============================================

  function toggleAssetDropdown(type: 'intro' | 'outro' | 'watermark') {
    openAssetDropdown.value = openAssetDropdown.value === type ? null : type;
  }

  function getSelectedIntroName(): string {
    if (!formData.value.intro_id) return 'No intro';
    const asset = introAssets.value.find((a) => a.id === formData.value.intro_id);
    return asset?.name || 'No intro';
  }

  function getSelectedOutroName(): string {
    if (!formData.value.outro_id) return 'No outro';
    const asset = outroAssets.value.find((a) => a.id === formData.value.outro_id);
    return asset?.name || 'No outro';
  }

  function getSelectedWatermarkName(): string {
    if (!formData.value.watermark_id) return 'No watermark';
    const asset = watermarkAssets.value.find((a) => a.id === formData.value.watermark_id);
    return asset?.name || 'No watermark';
  }

  function selectIntro(id: number | string | null) {
    formData.value.intro_id = id;
    openAssetDropdown.value = null;
  }

  function selectOutro(id: number | string | null) {
    formData.value.outro_id = id;
    openAssetDropdown.value = null;
  }

  function selectWatermark(id: number | string | null) {
    formData.value.watermark_id = id;
    openAssetDropdown.value = null;
    // Clear watermark settings if watermark is removed
    if (!id) {
      formData.value.watermark_settings = null;
    }
  }

  // Open watermark position picker
  function openWatermarkPositionPicker() {
    if (!formData.value.watermark_id) return;
    showWatermarkPositionPicker.value = true;
  }

  // Handle save from watermark position picker
  function handleWatermarkSettingsSave(settings: CreatorWatermarkSettings) {
    formData.value.watermark_settings = settings;
    showWatermarkPositionPicker.value = false;
  }

  // Count how many aspect ratios have watermark configured
  function getConfiguredRatiosCount(): number {
    if (!formData.value.watermark_settings) return 0;
    const settings = formData.value.watermark_settings;
    let count = 0;
    if (settings['16:9']) count++;
    if (settings['9:16']) count++;
    if (settings['1:1']) count++;
    if (settings['4:5']) count++;
    return count;
  }

  // ============================================
  // Overlay Management Functions
  // ============================================

  async function loadOverlayPreview(overlay: LayoutOverlay) {
    // For org overlays with assetId, find the server URL from orgAssets
    if (overlay.assetId && props.mode === 'organization') {
      const asset = orgAssets.value.find(a => a.id === overlay.assetId);
      if (asset?.url) {
        // Download all R2 assets through Tauri to bypass CORS
        try {
          console.log('[ProfileDialog] Downloading overlay through Tauri:', asset.url.substring(0, 80));
          const dataUrl = await invoke<string>('download_url_as_data_url', { url: asset.url });
          overlayPreviews.value[overlay.id] = dataUrl;
          return;
        } catch (err) {
          console.warn('[ProfileDialog] Failed to download overlay via Tauri, falling back to direct URL:', err);
          overlayPreviews.value[overlay.id] = asset.url;
          return;
        }
      }
    }
    // For local overlays, read from disk
    if (!overlay.imagePath) return;
    try {
      const dataUrl = await invoke<string>('read_file_as_data_url', { filePath: overlay.imagePath });
      overlayPreviews.value[overlay.id] = dataUrl;
    } catch (err) {
      console.warn('[ProfileDialog] Failed to load overlay preview:', overlay.id, err);
    }
  }

  async function loadAllOverlayPreviews() {
    overlayPreviews.value = {};
    for (const overlay of formData.value.layout_overlays) {
      await loadOverlayPreview(overlay);
    }
  }

  async function addLayoutOverlay() {
    if (uploadingOverlay.value) return;
    uploadingOverlay.value = true;
    try {
      const { open } = await import('@tauri-apps/plugin-dialog');
      const result = await open({
        multiple: false,
        filters: [{ name: 'Images & Videos', extensions: ['png', 'svg', 'webp', 'jpg', 'jpeg', 'mp4', 'mov', 'webm'] }],
      });
      if (!result) return;
      let filePath = result as string;
      let fileName = filePath.split(/[\\\/]/).pop() || 'overlay';
      const assetName = fileName.replace(/\.[^/.]+$/, '');

      if (props.mode === 'organization' && props.organizationId) {
        // Convert video to MP4 if needed (for browser compatibility)
        const videoExtensions = ['mov', 'webm', 'avi', 'mkv'];
        const ext = fileName.split('.').pop()?.toLowerCase() || '';
        
        if (videoExtensions.includes(ext)) {
          console.log('[ProfileDialog] Converting video to MP4:', filePath);
          try {
            // Convert video - output will be in temp directory
            filePath = await invoke<string>('convert_video_to_mp4', { inputPath: filePath });
            fileName = filePath.split(/[\\\/]/).pop() || 'overlay.mp4';
            console.log('[ProfileDialog] Video converted successfully:', filePath);
          } catch (conversionError) {
            console.error('[ProfileDialog] Video conversion failed:', conversionError);
            showError('Conversion Failed', 'Failed to convert video to browser-compatible format');
            return;
          }
        }

        // Org mode: upload as org asset, store assetId + server URL
        const finalExt = fileName.split('.').pop()?.toLowerCase() || 'png';
        const mimeMap: Record<string, string> = {
          png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
          webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif',
          mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
        };
        const bytes = await readFile(filePath);
        const file = new File([bytes], fileName, { type: mimeMap[finalExt] || 'image/png' });
        const dimensions = await extractImageDimensions(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'overlay', {
          name: assetName,
          width: dimensions.width ?? undefined,
          height: dimensions.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          const newOverlay: LayoutOverlay = {
            id: crypto.randomUUID(),
            imagePath: '',
            assetId: response.asset.id,
            x: 50,
            y: 50,
            width: 100,
            height: 10,
            opacity: 100,
            rotation: 0,
            label: assetName,
          };
          formData.value.layout_overlays.push(newOverlay);
          // Use server URL for preview
          overlayPreviews.value[newOverlay.id] = response.asset.url;
          showSuccess('Overlay Uploaded', `"${assetName}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload overlay');
        }
      } else {
        // Local mode: store local file path directly
        const newOverlay: LayoutOverlay = {
          id: crypto.randomUUID(),
          imagePath: filePath,
          x: 50,
          y: 50,
          width: 100,
          height: 10,
          opacity: 100,
          rotation: 0,
          label: assetName,
        };
        formData.value.layout_overlays.push(newOverlay);
        await loadOverlayPreview(newOverlay);
      }
    } catch (err: any) {
      console.error('[ProfileDialog] Failed to add overlay:', err);
      showError('Upload Failed', err.message || 'Failed to add overlay');
    } finally {
      uploadingOverlay.value = false;
    }
  }

  function removeLayoutOverlay(index: number) {
    const overlay = formData.value.layout_overlays[index];
    if (overlay) {
      delete overlayPreviews.value[overlay.id];
    }
    formData.value.layout_overlays.splice(index, 1);
  }

  function openOverlayPositionPicker(idx: number) {
    activeOverlayIndex.value = idx;
    showOverlayPositionPicker.value = true;
  }

  async function handleOverlayPositionSave(settings: PerRatioOverlaySettings) {
    if (activeOverlayIndex.value < 0 || activeOverlayIndex.value >= formData.value.layout_overlays.length) return;

    const overlay = formData.value.layout_overlays[activeOverlayIndex.value];
    
    // For organization mode, upload any per-ratio overlays that have imagePath to R2
    if (props.mode === 'organization' && props.organizationId) {
      const cleanedSettings: Partial<PerRatioOverlaySettings> = {};
      for (const [ratio, config] of Object.entries(settings)) {
        if (config) {
          // If this ratio has a local imagePath (uploaded in position picker), upload to R2
          if (config.imagePath && !config.assetId) {
            try {
              console.log(`[ProfileDialog] Uploading per-ratio overlay for ${ratio}:`, config.imagePath);
              const filePath = config.imagePath;
              const fileName = filePath.split(/[\\\/]/).pop() || 'overlay.mp4';
              const finalExt = fileName.split('.').pop()?.toLowerCase() || 'png';
              const mimeMap: Record<string, string> = {
                png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
                webp: 'image/webp', svg: 'image/svg+xml', gif: 'image/gif',
                mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm',
              };
              const bytes = await readFile(filePath);
              const file = new File([bytes], fileName, { type: mimeMap[finalExt] || 'image/png' });
              const assetName = fileName.replace(/\.[^/.]+$/, '');
              const dimensions = await extractImageDimensions(file);
              const response = await uploadOrganizationAsset(props.organizationId, file, 'overlay', {
                name: `${assetName}_${ratio.replace(':', 'x')}`,
                width: dimensions.width ?? undefined,
                height: dimensions.height ?? undefined,
              });

              if (response.success && response.asset) {
                orgAssets.value.push(response.asset);
                const { imagePath, ...rest } = config;
                cleanedSettings[ratio as keyof PerRatioOverlaySettings] = {
                  ...rest,
                  assetId: response.asset.id,
                } as any;
                // Update overlay preview with the R2 URL
                overlayPreviews.value[overlay.id] = response.asset.url;
                console.log(`[ProfileDialog] Per-ratio overlay uploaded for ${ratio}, assetId:`, response.asset.id);
              } else {
                console.error(`[ProfileDialog] Failed to upload per-ratio overlay for ${ratio}:`, response.error);
                cleanedSettings[ratio as keyof PerRatioOverlaySettings] = null;
              }
            } catch (uploadErr) {
              console.error(`[ProfileDialog] Error uploading per-ratio overlay for ${ratio}:`, uploadErr);
              cleanedSettings[ratio as keyof PerRatioOverlaySettings] = null;
            }
          } else {
            // Already has assetId or no imagePath — just strip imagePath
            const { imagePath, ...rest } = config;
            cleanedSettings[ratio as keyof PerRatioOverlaySettings] = rest as any;
          }
        } else {
          cleanedSettings[ratio as keyof PerRatioOverlaySettings] = null;
        }
      }
      overlay.perRatioSettings = cleanedSettings as PerRatioOverlaySettings;
    } else {
      overlay.perRatioSettings = settings;
    }

    const firstEnabled = settings['16:9'] || settings['9:16'] || settings['1:1'] || settings['4:5'];
    if (firstEnabled) {
      overlay.x = firstEnabled.x;
      overlay.y = firstEnabled.y;
      overlay.width = firstEnabled.width;
      overlay.height = firstEnabled.height;
      overlay.opacity = firstEnabled.opacity;
      overlay.rotation = firstEnabled.rotation;
    }

    showOverlayPositionPicker.value = false;
  }

  // Clean layout overlays for server submission: strip local-only fields
  function cleanOverlaysForServer(): Record<string, unknown>[] | null {
    if (formData.value.layout_overlays.length === 0) return null;
    return formData.value.layout_overlays.map(overlay => {
      const { imagePath, ...cleanOverlay } = overlay as any;
      if (cleanOverlay.perRatioSettings) {
        const cleanRatios: Record<string, any> = {};
        for (const [ratio, config] of Object.entries(cleanOverlay.perRatioSettings)) {
          if (config) {
            const { imagePath: _ip, imageUrl: _iu, ...cleanConfig } = config as any;
            cleanRatios[ratio] = cleanConfig;
          } else {
            cleanRatios[ratio] = null;
          }
        }
        cleanOverlay.perRatioSettings = cleanRatios;
      }
      return cleanOverlay;
    });
  }

  // Check if intro ratio settings are configured
  const hasIntroRatioConfig = computed((): boolean => {
    if (!formData.value.intro_ratio_settings) return false;
    try {
      const settings = JSON.parse(formData.value.intro_ratio_settings);
      return Object.values(settings).some(config => config !== null);
    } catch { return false; }
  });

  // Check if outro ratio settings are configured
  const hasOutroRatioConfig = computed((): boolean => {
    if (!formData.value.outro_ratio_settings) return false;
    try {
      const settings = JSON.parse(formData.value.outro_ratio_settings);
      return Object.values(settings).some(config => config !== null);
    } catch { return false; }
  });

  // Open ratio picker for intro or outro
  function openRatioPicker(mode: 'intro' | 'outro') {
    ratioPickerMode.value = mode;
    showIntroOutroRatioPicker.value = true;
  }

  // Get initial settings for the ratio picker based on mode
  function getInitialRatioSettings(mode: 'intro' | 'outro'): RatioAssetMap | null {
    const raw = mode === 'intro' ? formData.value.intro_ratio_settings : formData.value.outro_ratio_settings;
    if (!raw) return null;
    try { return JSON.parse(raw); } catch { return null; }
  }

  // Handle save from ratio picker
  function handleRatioSettingsSave(settings: RatioAssetMap) {
    if (ratioPickerMode.value === 'intro') {
      formData.value.intro_ratio_settings = JSON.stringify(settings);
    } else {
      formData.value.outro_ratio_settings = JSON.stringify(settings);
    }
    showIntroOutroRatioPicker.value = false;
  }

  // ============================================
  // Asset Upload Functions
  // ============================================

  async function extractVideoMetadata(videoBlob: Blob): Promise<{
    duration: number | null;
    width: number | null;
    height: number | null;
    thumbnail: File | null;
  }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      const result = {
        duration: null as number | null,
        width: null as number | null,
        height: null as number | null,
        thumbnail: null as File | null,
      };

      const cleanup = () => {
        URL.revokeObjectURL(video.src);
      };

      video.onloadedmetadata = () => {
        result.duration = video.duration;
        result.width = video.videoWidth;
        result.height = video.videoHeight;
        video.currentTime = Math.min(1, video.duration / 2);
      };

      video.onseeked = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            canvas.toBlob(
              (blob) => {
                if (blob) {
                  result.thumbnail = new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' });
                }
                cleanup();
                resolve(result);
              },
              'image/jpeg',
              0.8
            );
          } else {
            cleanup();
            resolve(result);
          }
        } catch {
          cleanup();
          resolve(result);
        }
      };

      video.onerror = () => {
        cleanup();
        resolve(result);
      };

      setTimeout(() => {
        if (!result.duration) {
          cleanup();
          resolve(result);
        }
      }, 10000);

      video.src = URL.createObjectURL(videoBlob);
    });
  }

  async function extractImageDimensions(imageBlob: Blob): Promise<{ width: number | null; height: number | null }> {
    return new Promise((resolve) => {
      const img = new window.Image();

      img.onload = () => {
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
        URL.revokeObjectURL(img.src);
      };

      img.onerror = () => {
        resolve({ width: null, height: null });
        URL.revokeObjectURL(img.src);
      };

      img.src = URL.createObjectURL(imageBlob);
    });
  }

  async function selectVideoFileNative(): Promise<File | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [
        {
          name: 'Video Files',
          extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'],
        },
      ],
    });
    if (!selected || typeof selected !== 'string') return null;

    const fileName = selected.split(/[\\\/]/).pop() || 'file';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm', flv: 'video/x-flv',
      wmv: 'video/x-ms-wmv', m4v: 'video/x-m4v',
    };
    const bytes = await readFile(selected);
    return new File([bytes], fileName, { type: mimeMap[ext] || 'video/mp4' });
  }

  async function handleIntroUploadClick() {
    uploadingIntro.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const file = await selectVideoFileNative();
        if (!file) { uploadingIntro.value = false; return; }
        const metadata = await extractVideoMetadata(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'intro', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          thumbnail: metadata.thumbnail ?? undefined,
          duration: metadata.duration ?? undefined,
          width: metadata.width ?? undefined,
          height: metadata.height ?? undefined,
        });
        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.intro_id = response.asset.id;
          showSuccess('Intro Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload intro');
        }
      } else {
        pendingUploadType.value = 'intro';
        await uploadVideoAsset('intro');
      }
    } catch (err: any) {
      console.error('Intro upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload intro');
      pendingUploadType.value = null;
    } finally {
      uploadingIntro.value = false;
    }
  }

  async function handleOutroUploadClick() {
    uploadingOutro.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const file = await selectVideoFileNative();
        if (!file) { uploadingOutro.value = false; return; }
        const metadata = await extractVideoMetadata(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'outro', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          thumbnail: metadata.thumbnail ?? undefined,
          duration: metadata.duration ?? undefined,
          width: metadata.width ?? undefined,
          height: metadata.height ?? undefined,
        });
        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.outro_id = response.asset.id;
          showSuccess('Outro Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload outro');
        }
      } else {
        pendingUploadType.value = 'outro';
        await uploadVideoAsset('outro');
      }
    } catch (err: any) {
      console.error('Outro upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload outro');
      pendingUploadType.value = null;
    } finally {
      uploadingOutro.value = false;
    }
  }

  async function handleWatermarkUploadLocal() {
    uploadingWatermark.value = true;
    try {
      const result = await uploadWatermark();
      if (result.success && result.watermarkId) {
        await loadLocalAssets();
        formData.value.watermark_id = result.watermarkId;
      }
    } catch (err: any) {
      console.error('Watermark upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload watermark');
    } finally {
      uploadingWatermark.value = false;
    }
  }

  async function handleWatermarkUpload(event: Event) {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    uploadingWatermark.value = true;
    try {
      if (props.mode === 'organization' && props.organizationId) {
        const dimensions = await extractImageDimensions(file);
        const response = await uploadOrganizationAsset(props.organizationId, file, 'watermark', {
          name: file.name.replace(/\.[^/.]+$/, ''),
          width: dimensions.width ?? undefined,
          height: dimensions.height ?? undefined,
        });

        if (response.success && response.asset) {
          orgAssets.value.push(response.asset);
          formData.value.watermark_id = response.asset.id;
          showSuccess('Watermark Uploaded', `"${response.asset.name}" has been uploaded`);
        } else {
          showError('Upload Failed', response.error || 'Failed to upload watermark');
        }
      }
    } catch (err: any) {
      console.error('Watermark upload error:', err);
      showError('Upload Failed', err.message || 'Failed to upload watermark');
    } finally {
      uploadingWatermark.value = false;
      input.value = '';
    }
  }

  // Register callback for async intro/outro upload completion (local mode)
  const unregisterUploadComplete = onUploadComplete(async () => {
    if (pendingUploadType.value && props.mode === 'local') {
      const uploadType = pendingUploadType.value;
      pendingUploadType.value = null;

      // Reload assets to get the newly uploaded one
      await loadLocalAssets();

      // Find the most recently created asset of the uploaded type
      const assetList = uploadType === 'intro' ? localIntros.value : localOutros.value;
      if (assetList.length > 0) {
        // Sort by created_at descending to get the newest
        const newest = assetList.reduce((a, b) => (a.created_at > b.created_at ? a : b));

        // Auto-select the newest asset
        if (uploadType === 'intro') {
          formData.value.intro_id = newest.id;
        } else {
          formData.value.outro_id = newest.id;
        }
      }
    }
  });

  // Clean up callback registration when component is unmounted
  onUnmounted(() => {
    unregisterUploadComplete();
  });

  // ============================================
  // Form Submit
  // ============================================

  /**
   * Get profile image URL from platform links
   * Prefers the primary link, then falls back to any link with an image
   */
  function getProfileImageFromLinks(): string | undefined {
    const links = formData.value.platformLinks;
    // First try to get from primary link
    const primaryLink = links.find((l) => l.is_primary && l.profile_image_url);
    if (primaryLink?.profile_image_url) {
      return primaryLink.profile_image_url;
    }
    // Fallback to any link with a profile image
    const linkWithImage = links.find((l) => l.profile_image_url);
    return linkWithImage?.profile_image_url || undefined;
  }

  async function handleSubmit() {
    if (!formData.value.name) return;

    saving.value = true;

    try {
      if (props.mode === 'organization') {
        await handleOrganizationSubmit();
      } else {
        await handleLocalSubmit();
      }
    } catch (err: any) {
      console.error('Failed to save profile:', err);
      showError('Save Failed', err.message || 'An error occurred');
    } finally {
      saving.value = false;
    }
  }

  async function handleOrganizationSubmit() {
    if (!props.organizationId) return;

    let profile: ServerOrganizationCreatorProfile | undefined;
    const profileImageUrl = getProfileImageFromLinks();

    // Helper to extract numeric ID from org-asset-X format
    const extractNumericId = (id: string | number | null): number | null => {
      if (id === null || id === undefined) return null;
      const str = String(id);
      if (str.startsWith('org-asset-')) {
        const num = parseInt(str.replace('org-asset-', ''), 10);
        return isNaN(num) ? null : num;
      }
      const num = parseInt(str, 10);
      return isNaN(num) ? null : num;
    };

    if (isEditing.value && props.profile) {
      // Update existing profile
      const updateData = {
        name: formData.value.name,
        description: formData.value.description || null,
        profile_image_url: profileImageUrl || null,
        intro_id: extractNumericId(formData.value.intro_id),
        outro_id: extractNumericId(formData.value.outro_id),
        watermark_id: extractNumericId(formData.value.watermark_id),
        watermark_settings: formData.value.watermark_settings,
        intro_outro_settings: formData.value.intro_outro_settings ? JSON.parse(formData.value.intro_outro_settings) : null,
        layout_overlays: cleanOverlaysForServer(),
        scope: formData.value.scope === 'personal_studio' ? 'streamer' : formData.value.scope,
      };
      const response = await updateOrganizationCreatorProfile(props.organizationId, props.profile.id, updateData);

      if (!response.success || !response.profile) {
        throw new Error(response.error || 'Failed to update profile');
      }

      profile = response.profile;

      // Handle platform link changes
      const existingLinks = props.profile.platform_links;
      const newLinks = formData.value.platformLinks;

      // Delete removed links
      for (const existing of existingLinks) {
        const stillExists = newLinks.some((l) => l.id === existing.id);
        if (!stillExists) {
          await apiDeletePlatformLink(props.organizationId, props.profile.id, existing.id);
        }
      }

      // Add new links
      for (const link of newLinks) {
        if (link.isNew && link.platform_id.trim()) {
          await apiAddPlatformLink(props.organizationId, props.profile.id, {
            platform: link.platform,
            platform_id: link.platform_id,
            display_name: link.display_name || undefined,
            profile_image_url: link.profile_image_url || undefined,
            is_primary: link.is_primary,
          });
        }
      }

      showSuccess('Profile Updated', `"${profile.name}" has been updated`);
    } else {
      // Create new profile
      const response = await createOrganizationCreatorProfile(props.organizationId, {
        name: formData.value.name,
        description: formData.value.description || undefined,
        profile_image_url: profileImageUrl,
        intro_id: extractNumericId(formData.value.intro_id),
        outro_id: extractNumericId(formData.value.outro_id),
        watermark_id: extractNumericId(formData.value.watermark_id),
        watermark_settings: formData.value.watermark_settings || undefined,
        layout_overlays: cleanOverlaysForServer(),
        scope: formData.value.scope === 'personal_studio' ? 'streamer' : formData.value.scope,
      });

      if (!response.success || !response.profile) {
        throw new Error(response.error || 'Failed to create profile');
      }

      profile = response.profile;

      // Add platform links
      for (const link of formData.value.platformLinks) {
        if (link.platform_id.trim()) {
          await apiAddPlatformLink(props.organizationId, profile.id, {
            platform: link.platform,
            platform_id: link.platform_id,
            display_name: link.display_name || undefined,
            profile_image_url: link.profile_image_url || undefined,
            is_primary: link.is_primary,
          });
        }
      }

      showSuccess('Profile Created', `"${profile.name}" has been created`);
    }

    emit('saved', profile);
    emit('close');
  }

  async function handleLocalSubmit() {
    const validLinks = formData.value.platformLinks.filter((l) => l.platform_id.trim());

    // Find the first existing profile image to reuse for all links
    const firstProfileImage = validLinks.find((l) => l.profile_image_url)?.profile_image_url;

    // Normalize platform IDs and handle profile images
    for (const link of validLinks) {
      if (link.platform === 'pumpfun') {
        const mintId = extractMintId(link.platform_id.trim());
        if (mintId) {
          link.platform_id = mintId;
        }
        if (!link.profile_image_url && firstProfileImage) {
          link.profile_image_url = firstProfileImage;
        }
      } else if (link.platform === 'kick') {
        const slug = extractChannelSlug(link.platform_id.trim());
        if (slug) {
          link.platform_id = slug;
        }
      }
    }

    // Helper to process a single link (create or update)
    const processLink = async (creatorId: string, link: PlatformLinkInput) => {
      let monitoredStreamerId: string | null = null;

      // Resolve monitored streamer for supported platforms
      if (link.platform === 'pumpfun' || link.platform === 'kick' || link.platform === 'twitch' || link.platform === 'youtube' || link.platform === 'rumble') {
        try {
          const existing = await getMonitoredStreamerByMint(link.platform_id.trim());
          if (existing) {
            monitoredStreamerId = existing.id;
          } else {
            monitoredStreamerId = await createMonitoredStreamer(
              link.platform_id.trim(),
              link.display_name.trim() || formData.value.name.trim(),
              link.profile_image_url || undefined,
              5, // segment duration
              formData.value.auto_dvr_enabled,
              platformInputToDb(link.platform)
            );
          }
        } catch (err) {
          console.warn('[ProfileDialog] Failed to resolve monitored_streamer:', err);
        }
      }

      if (link.id && !link.isNew) {
        // Update existing link
        await dbUpdatePlatformLink(String(link.id), {
          platform: platformInputToDb(link.platform),
          platform_id: link.platform_id.trim(),
          display_name: link.display_name.trim() || null,
          profile_image_url: link.profile_image_url || null,
          monitored_streamer_id: monitoredStreamerId,
          is_primary: link.is_primary,
        });
      } else {
        // Create new link
        await dbAddPlatformLink(
          creatorId,
          platformInputToDb(link.platform),
          link.platform_id.trim(),
          link.display_name.trim() || null,
          link.profile_image_url || null,
          monitoredStreamerId,
          link.is_primary
        );
      }
    };

    if (isEditing.value && props.creator) {
      // Update existing creator
      await updateCreatorProfile(props.creator.id, {
        name: formData.value.name.trim(),
        description: formData.value.description.trim() || null,
        intro_id: formData.value.intro_id as string | null,
        outro_id: formData.value.outro_id as string | null,
        watermark_id: formData.value.watermark_id as string | null,
        watermark_settings: formData.value.watermark_settings
          ? JSON.stringify(formData.value.watermark_settings)
          : null,
        intro_outro_settings: formData.value.intro_outro_settings,
        intro_ratio_settings: formData.value.intro_ratio_settings,
        outro_ratio_settings: formData.value.outro_ratio_settings,
        auto_dvr_enabled: formData.value.auto_dvr_enabled ? 1 : 0,
        layout_overlays: formData.value.layout_overlays.length > 0
          ? JSON.stringify(formData.value.layout_overlays)
          : null,
        clip_build_defaults: hasClipDefaultsConfig.value
          ? serializeCreatorClipBuildDefaults(formData.value.clip_build_defaults)
          : null,
      });

      // Delete removed links
      const formIds = new Set(validLinks.filter((l) => l.id && !l.isNew).map((l) => String(l.id)));
      for (const link of props.creator.platform_links) {
        if (!formIds.has(link.id)) {
          await dbDeletePlatformLink(link.id);
        }
      }

      // Process all links (add or update)
      for (const link of validLinks) {
        await processLink(props.creator.id, link);
      }

      showSuccess(
        formData.value.scope === 'global' ? 'Branding Updated' : 'Creator Updated',
        `"${formData.value.name}" has been updated`
      );
    } else {
      // Create new creator
      const creatorId = await createCreatorProfile(
        formData.value.name.trim(),
        formData.value.description.trim() || null,
        null, // profile_image_path
        formData.value.intro_id as string | null,
        formData.value.outro_id as string | null,
        formData.value.watermark_id as string | null,
        formData.value.watermark_settings ? JSON.stringify(formData.value.watermark_settings) : null,
        formData.value.intro_outro_settings,
        formData.value.auto_dvr_enabled,
        formData.value.intro_ratio_settings,
        formData.value.outro_ratio_settings,
        formData.value.scope,
        formData.value.layout_overlays.length > 0
          ? JSON.stringify(formData.value.layout_overlays)
          : null,
        hasClipDefaultsConfig.value
          ? serializeCreatorClipBuildDefaults(formData.value.clip_build_defaults)
          : null
      );

      // Add platform links
      for (const link of validLinks) {
        await processLink(creatorId, link);
      }

      showSuccess(
        formData.value.scope === 'global' ? 'Branding Created' : 'Creator Created',
        `"${formData.value.name}" has been added`
      );
    }

    // Notify other components (like LiveClip.vue) about the new/updated monitoring data
    window.dispatchEvent(new CustomEvent('monitored-streamers-updated'));

    emit('saved');
    emit('close');
  }
</script>
