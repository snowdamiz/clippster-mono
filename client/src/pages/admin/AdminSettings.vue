<template>
  <PageLayout
    title="Settings"
    description="Feature flags and UI configuration"
    :icon="Settings"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Settings' }]"
  >
    <div class="flex w-full max-w-[880px] flex-col gap-4 px-5 py-4">
      <!-- Feature flags -->
      <SectionCard
        title="Feature flags"
        description="Changes take effect immediately for all users"
        :icon="Flag"
        body-class="py-0"
      >
        <template #actions>
          <Loader2 v-if="featureFlagsLoading" class="size-4 animate-spin text-fg-subtle" aria-label="Loading flags" />
        </template>

        <SettingRow label="Live Clip" :icon="Radio">
          <template #description>
            Real-time stream monitoring, recording and clip detection.
            <span v-if="!featureFlagsLoading && !isLiveClipEnabled" class="block text-warning">
              Off — the Live Clip page and monitoring controls are hidden from all users.
            </span>
          </template>
          <Loader2 v-if="updatingLiveClipFlag" class="size-3.5 animate-spin text-fg-subtle" />
          <Switch
            :model-value="isLiveClipEnabled"
            :disabled="featureFlagsLoading || updatingLiveClipFlag"
            aria-label="Live Clip"
            @update:model-value="toggleLiveClipFeature"
          />
        </SettingRow>

        <SettingRow
          v-for="flag in rolloutFlagDefinitions"
          :key="flag.key"
          :label="flag.name"
          :description="flag.description"
          :icon="flag.icon"
        >
          <Loader2 v-if="updatingRolloutFlags[flag.key]" class="size-3.5 animate-spin text-fg-subtle" />
          <Switch
            :model-value="rolloutFlagValues[flag.key]"
            :disabled="featureFlagsLoading || updatingRolloutFlags[flag.key]"
            :aria-label="flag.name"
            @update:model-value="toggleRolloutFeature(flag.key)"
          />
        </SettingRow>

        <SettingRow label="Beta mode" :icon="KeyRound">
          <template #description>
            Require new users to enter a beta code before accessing the app.
            <span v-if="isBetaModeEnabled" class="block text-warning">
              On — new users need a valid code.
              <router-link to="/admin/beta-codes" class="underline-offset-2 hover:underline">Manage beta codes</router-link>
            </span>
          </template>
          <Loader2 v-if="updatingBetaModeFlag" class="size-3.5 animate-spin text-fg-subtle" />
          <Switch
            :model-value="isBetaModeEnabled"
            :disabled="featureFlagsLoading || updatingBetaModeFlag"
            aria-label="Beta mode"
            @update:model-value="toggleBetaModeFeature"
          />
        </SettingRow>
      </SectionCard>

      <!-- Tools: title bar override + leaderboard recalculation -->
      <SectionCard title="Tools" :icon="Wrench" body-class="py-0">
        <SettingRow label="Title bar platform" :icon="Monitor">
          <template #description>
            Render the title bar as another OS to test platform-specific styling.
            <span v-if="titleBarPlatformOverride !== 'auto'" class="block text-warning">
              Rendering as {{ getPlatformDisplayName(titleBarPlatformOverride) }} ·
              <button type="button" class="text-brand underline-offset-2 hover:underline" @click="setTitleBarOverride('auto')">
                Reset to auto
              </button>
            </span>
          </template>
          <SegmentedControl
            :model-value="titleBarPlatformOverride"
            :options="platformOptions"
            size="sm"
            @update:model-value="setTitleBarOverride"
          />
        </SettingRow>

        <SettingRow
          label="Recalculate leaderboard"
          description="Runs every Monday (weekly) and on the 1st of each month (monthly) at 00:00 UTC"
          :icon="Trophy"
        >
          <Button
            v-for="period in leaderboardPeriods"
            :key="period.value"
            variant="secondary"
            size="sm"
            :loading="refreshingLeaderboard === period.value"
            :disabled="refreshingLeaderboard !== null"
            @click="refreshLeaderboard(period.value)"
          >
            <RefreshCw v-if="refreshingLeaderboard !== period.value" />
            {{ period.label }}
          </Button>
        </SettingRow>
        <Alert
          v-if="leaderboardRefreshResult"
          :variant="leaderboardRefreshResult.success ? 'success' : 'destructive'"
          class="mb-3 animate-enter"
        >
          <Check v-if="leaderboardRefreshResult.success" />
          <AlertTriangle v-else />
          <AlertDescription>{{ leaderboardRefreshResult.message }}</AlertDescription>
        </Alert>
      </SectionCard>

      <!-- Free tier branding -->
      <SectionCard
        title="Free tier branding"
        description="Watermark, intro and outro applied to every free tier output; free users can't override them"
        :icon="Stamp"
        body-class="py-0"
      >
        <template #actions>
          <Badge :variant="freeTierBrandingConfigured ? 'success' : 'neutral'">
            {{ freeTierBrandingConfigured ? 'Configured' : 'Not set' }}
          </Badge>
        </template>

        <SettingRow label="Watermark" :icon="ImageIconLucide">
          <template #description>
            <span class="block truncate">{{ selectedWatermark?.name || 'No watermark selected' }}</span>
            <span v-if="watermarkConfiguredRatios > 0" class="block text-fg-subtle">
              Position set for {{ watermarkConfiguredRatios }} aspect ratio{{ watermarkConfiguredRatios !== 1 ? 's' : '' }}
            </span>
          </template>
          <Button
            variant="ghost"
            size="icon-sm"
            :class="{ 'text-brand': watermarkConfiguredRatios > 0 }"
            :disabled="!freeTierBranding.watermark_id"
            title="Configure watermark position"
            aria-label="Configure watermark position"
            @click="openWatermarkPositionPicker"
          >
            <Settings2 />
          </Button>
          <Button variant="secondary" size="sm" :loading="uploadingWatermark" :disabled="uploadingWatermark" @click="handleWatermarkUpload">
            <Upload v-if="!uploadingWatermark" />
            Upload
          </Button>
        </SettingRow>

        <SettingRow label="Intro" :icon="Play">
          <template #description>
            <span class="block truncate">
              {{
                selectedIntroName ||
                (introConfiguredRatios > 0 ? `${introConfiguredRatios} ratio(s) configured` : 'No intro configured')
              }}
            </span>
            <span v-if="introConfiguredRatios > 0" class="block text-fg-subtle">Per-ratio intros configured</span>
          </template>
          <Button
            variant="ghost"
            size="icon-sm"
            :class="{ 'text-brand': introConfiguredRatios > 0 }"
            title="Configure intro per aspect ratio"
            aria-label="Configure intro per aspect ratio"
            @click="showIntroRatioPicker = true"
          >
            <Settings2 />
          </Button>
          <Button variant="secondary" size="sm" :loading="uploadingIntro" :disabled="uploadingIntro" @click="handleIntroUpload">
            <Upload v-if="!uploadingIntro" />
            Upload
          </Button>
        </SettingRow>

        <SettingRow label="Outro" :icon="SkipForward">
          <template #description>
            <span class="block truncate">
              {{
                selectedOutroName ||
                (outroConfiguredRatios > 0 ? `${outroConfiguredRatios} ratio(s) configured` : 'No outro configured')
              }}
            </span>
            <span v-if="outroConfiguredRatios > 0" class="block text-fg-subtle">Per-ratio outros configured</span>
          </template>
          <Button
            variant="ghost"
            size="icon-sm"
            :class="{ 'text-brand': outroConfiguredRatios > 0 }"
            title="Configure outro per aspect ratio"
            aria-label="Configure outro per aspect ratio"
            @click="showOutroRatioPicker = true"
          >
            <Settings2 />
          </Button>
          <Button variant="secondary" size="sm" :loading="uploadingOutro" :disabled="uploadingOutro" @click="handleOutroUpload">
            <Upload v-if="!uploadingOutro" />
            Upload
          </Button>
        </SettingRow>

        <div class="flex items-center justify-end gap-2 border-t border-line-subtle py-3">
          <span class="mr-auto text-xs text-fg-subtle">
            {{
              freeTierBrandingConfigured
                ? 'Free tier outputs will include this watermark, intro and outro'
                : 'Free tier outputs will not have any branding applied'
            }}
          </span>
          <Button variant="primary" size="sm" :loading="savingBranding" :disabled="savingBranding" @click="saveFreeTierBranding">
            {{ savingBranding ? 'Saving…' : 'Save branding' }}
          </Button>
        </div>
      </SectionCard>
    </div>

    <!-- Watermark Position Picker -->
    <WatermarkPositionPicker
      :show="showWatermarkPositionPicker"
      :watermark-id="freeTierBranding.watermark_id"
      :settings="freeTierBranding.watermark_settings || undefined"
      @close="showWatermarkPositionPicker = false"
      @save="saveWatermarkPosition"
    />

    <!-- Intro Ratio Picker -->
    <IntroOutroRatioPicker
      :show="showIntroRatioPicker"
      mode="intro"
      :initial-settings="freeTierBranding.intro_settings || undefined"
      @close="showIntroRatioPicker = false"
      @save="saveIntroSettings"
    />

    <!-- Outro Ratio Picker -->
    <IntroOutroRatioPicker
      :show="showOutroRatioPicker"
      mode="outro"
      :initial-settings="freeTierBranding.outro_settings || undefined"
      @close="showOutroRatioPicker = false"
      @save="saveOutroSettings"
    />
  </PageLayout>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted } from 'vue';
  import {
    Settings,
    Radio,
    KeyRound,
    Check,
    Loader2,
    Trophy,
    RefreshCw,
    Upload,
    Play,
    SkipForward,
    Settings2,
    Image as ImageIconLucide,
    Wand2,
    Paintbrush,
    Globe2,
    Megaphone,
    Flag,
    Monitor,
    Stamp,
    AlertTriangle,
    Wrench,
  } from 'lucide-vue-next';
  import api from '@/services/api';
  import PageLayout from '@/components/PageLayout.vue';
  import { Alert, AlertDescription } from '@/components/ui/alert';
  import { Badge } from '@/components/ui/badge';
  import { Button } from '@/components/ui/button';
  import { SegmentedControl, type SegmentedOption } from '@/components/ui/segmented-control';
  import { Switch } from '@/components/ui/switch';
  import { SectionCard } from '@/components/ui/section-card';
  import { SettingRow } from '@/components/ui/setting-row';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useToast } from '@/composables/useToast';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from '@/components/WatermarkPositionPicker.vue';
  import IntroOutroRatioPicker from '@/components/IntroOutroRatioPicker.vue';
  import type { RatioAssetMap } from '@/services/database/types';
  import {
    listOrganizationAssets,
    uploadOrganizationAsset,
    type ServerOrganizationAsset,
  } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
  import { readFile } from '@tauri-apps/plugin-fs';

  const {
    isLiveClipEnabled,
    isBetaModeEnabled,
    isAIVideoEnabled,
    isImageEditorEnabled,
    isTokendEnabled,
    isCampaignsEnabled,
    isLoading: featureFlagsLoading,
    fetchFeatureFlags,
    setLiveClipEnabled,
    setBetaModeEnabled,
    setRolloutFlag,
  } = useFeatureFlags();

  const { success, error } = useToast();
  const authStore = useAuthStore();

  const adminOrgId = computed(() => (authStore.user as any)?.owned_organization_id ?? null);

  const updatingLiveClipFlag = ref(false);
  const updatingBetaModeFlag = ref(false);
  type RolloutFlagKey = 'ai_video_enabled' | 'image_editor_enabled' | 'tokend_enabled' | 'campaigns_enabled';

  const updatingRolloutFlags = ref<Record<RolloutFlagKey, boolean>>({
    ai_video_enabled: false,
    image_editor_enabled: false,
    tokend_enabled: false,
    campaigns_enabled: false,
  });
  const rolloutFlagDefinitions = [
    {
      key: 'ai_video_enabled',
      name: 'AI video editor',
      description: 'Release AI video creation to every user while retaining individual access grants.',
      icon: Wand2,
    },
    {
      key: 'image_editor_enabled',
      name: 'Image editor',
      description: 'Release the image editor and AI image creation tools to every user.',
      icon: Paintbrush,
    },
    {
      key: 'tokend_enabled',
      name: 'Tokend',
      description: 'Release Tokend browsing, account connections, downloads, and publishing to every user.',
      icon: Globe2,
    },
    {
      key: 'campaigns_enabled',
      name: 'Campaigns',
      description: 'Release campaign discovery and participation access to every user.',
      icon: Megaphone,
    },
  ] as const;
  const rolloutFlagValues = computed<Record<RolloutFlagKey, boolean>>(() => ({
    ai_video_enabled: isAIVideoEnabled.value,
    image_editor_enabled: isImageEditorEnabled.value,
    tokend_enabled: isTokendEnabled.value,
    campaigns_enabled: isCampaignsEnabled.value,
  }));
  const titleBarPlatformOverride = ref<string>('auto');

  const platformOptions: SegmentedOption<string>[] = [
    { value: 'auto', label: 'Auto detect' },
    { value: 'windows', label: 'Windows' },
    { value: 'macos', label: 'macOS' },
    { value: 'linux', label: 'Linux' },
  ];

  const leaderboardPeriods = [
    { value: 'weekly', label: 'Weekly' },
    { value: 'monthly', label: 'Monthly' },
    { value: 'both', label: 'Both' },
  ] as const;

  const toggleRolloutFeature = async (key: RolloutFlagKey) => {
    updatingRolloutFlags.value[key] = true;
    try {
      const enabled = !rolloutFlagValues.value[key];
      const updated = await setRolloutFlag(key, enabled);
      if (!updated) {
        error('Update failed', 'The platform-wide feature setting could not be updated.');
      }
    } finally {
      updatingRolloutFlags.value[key] = false;
    }
  };

  const toggleLiveClipFeature = async () => {
    updatingLiveClipFlag.value = true;
    try {
      const newValue = !isLiveClipEnabled.value;
      await setLiveClipEnabled(newValue);
    } catch (err) {
      console.error('Error toggling Live Clip feature:', err);
    } finally {
      updatingLiveClipFlag.value = false;
    }
  };

  const toggleBetaModeFeature = async () => {
    updatingBetaModeFlag.value = true;
    try {
      const newValue = !isBetaModeEnabled.value;
      await setBetaModeEnabled(newValue);
    } catch (err) {
      console.error('Error toggling Beta Mode feature:', err);
    } finally {
      updatingBetaModeFlag.value = false;
    }
  };

  const setTitleBarOverride = (platform: string) => {
    titleBarPlatformOverride.value = platform;
    localStorage.setItem('titlebar-platform-override', platform);
    window.dispatchEvent(
      new CustomEvent('titlebar-platform-override', {
        detail: { platform },
      })
    );
  };

  const getPlatformDisplayName = (platform: string) => {
    switch (platform) {
      case 'auto':
        return 'Auto detect';
      case 'windows':
        return 'Windows';
      case 'macos':
        return 'macOS';
      case 'linux':
        return 'Linux';
      default:
        return platform;
    }
  };

  const loadPlatformOverride = () => {
    const saved = localStorage.getItem('titlebar-platform-override');
    if (saved) {
      titleBarPlatformOverride.value = saved;
      window.dispatchEvent(
        new CustomEvent('titlebar-platform-override', {
          detail: { platform: saved },
        })
      );
    }
  };

  // Free tier branding
  const freeTierBranding = ref<{
    watermark_id: string | null;
    watermark_settings: CreatorWatermarkSettings | null;
    intro_settings: RatioAssetMap | null;
    outro_settings: RatioAssetMap | null;
  }>({
    watermark_id: null,
    watermark_settings: null,
    intro_settings: null,
    outro_settings: null,
  });
  const savingBranding = ref(false);
  const uploadingWatermark = ref(false);
  const uploadingIntro = ref(false);
  const uploadingOutro = ref(false);

  // Watermark picker state
  const showWatermarkPositionPicker = ref(false);
  const orgAssets = ref<ServerOrganizationAsset[]>([]);
  // Helper: extract numeric server ID from 'org-asset-{id}' or plain string
  function extractServerId(assetId: string | null | undefined): number | null {
    if (!assetId) return null;
    if (assetId.startsWith('org-asset-')) return parseInt(assetId.replace('org-asset-', ''), 10) || null;
    const n = parseInt(assetId, 10);
    return isNaN(n) ? null : n;
  }

  const selectedWatermark = computed(() => {
    if (!freeTierBranding.value.watermark_id) return null;
    const sid = extractServerId(freeTierBranding.value.watermark_id);
    return orgAssets.value.find((a) => a.id === sid);
  });
  const selectedIntroName = computed(() => {
    const introSettings = freeTierBranding.value.intro_settings;
    if (!introSettings) return null;
    const firstEntry = Object.values(introSettings).find(
      (v): v is { assetId: string } => v !== null && v !== undefined
    );
    if (!firstEntry) return null;
    const sid = extractServerId(firstEntry.assetId);
    const asset = orgAssets.value.find((a) => a.id === sid);
    return asset?.name ?? null;
  });
  const selectedOutroName = computed(() => {
    const outroSettings = freeTierBranding.value.outro_settings;
    if (!outroSettings) return null;
    const firstEntry = Object.values(outroSettings).find(
      (v): v is { assetId: string } => v !== null && v !== undefined
    );
    if (!firstEntry) return null;
    const sid = extractServerId(firstEntry.assetId);
    const asset = orgAssets.value.find((a) => a.id === sid);
    return asset?.name ?? null;
  });

  // Intro/Outro picker state
  const showIntroRatioPicker = ref(false);
  const showOutroRatioPicker = ref(false);

  const refreshingLeaderboard = ref<'weekly' | 'monthly' | 'both' | null>(null);
  const leaderboardRefreshResult = ref<{ success: boolean; message: string } | null>(null);

  async function refreshLeaderboard(periodType: 'weekly' | 'monthly' | 'both') {
    refreshingLeaderboard.value = periodType;
    leaderboardRefreshResult.value = null;
    try {
      const response = await api.post('/admin/leaderboard/refresh', { period_type: periodType });
      leaderboardRefreshResult.value = {
        success: response.data.success,
        message: response.data.message || 'Leaderboard recalculated successfully',
      };
    } catch (err: any) {
      leaderboardRefreshResult.value = {
        success: false,
        message: err?.response?.data?.error || 'Failed to refresh leaderboard',
      };
    } finally {
      refreshingLeaderboard.value = null;
      setTimeout(() => {
        leaderboardRefreshResult.value = null;
      }, 5000);
    }
  }

  const freeTierBrandingConfigured = computed(() => {
    const hasWatermark = !!freeTierBranding.value.watermark_id;
    const hasIntro =
      !!freeTierBranding.value.intro_settings &&
      Object.values(freeTierBranding.value.intro_settings).some((v) => v !== null);
    const hasOutro =
      !!freeTierBranding.value.outro_settings &&
      Object.values(freeTierBranding.value.outro_settings).some((v) => v !== null);
    return hasWatermark || hasIntro || hasOutro;
  });

  const watermarkConfiguredRatios = computed(() => {
    if (!freeTierBranding.value.watermark_settings) return 0;
    return Object.values(freeTierBranding.value.watermark_settings).filter((v) => v !== null).length;
  });

  const introConfiguredRatios = computed(() => {
    if (!freeTierBranding.value.intro_settings) return 0;
    return Object.values(freeTierBranding.value.intro_settings).filter((v) => v !== null).length;
  });

  const outroConfiguredRatios = computed(() => {
    if (!freeTierBranding.value.outro_settings) return 0;
    return Object.values(freeTierBranding.value.outro_settings).filter((v) => v !== null).length;
  });

  async function loadFreeTierBranding() {
    try {
      const response = await api.get('/admin/free-tier-branding');
      if (response.data.success && response.data.branding) {
        const b = response.data.branding;
        freeTierBranding.value = {
          watermark_id: b.watermark_id || null,
          watermark_settings: b.watermark_settings || null,
          intro_settings: b.intro_settings || null,
          outro_settings: b.outro_settings || null,
        };
      }
    } catch (err) {
      console.warn('[AdminSettings] Failed to load free tier branding:', err);
    }
  }

  async function loadAssets() {
    const orgId = adminOrgId.value;
    if (!orgId) return;
    try {
      const response = await listOrganizationAssets(orgId);
      if (response.success) {
        orgAssets.value = response.assets;
      }
    } catch (err) {
      console.warn('[AdminSettings] Failed to load org assets:', err);
    }
  }

  async function selectVideoFileNative(): Promise<File | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Video Files', extensions: ['mp4', 'mov', 'avi', 'mkv', 'webm', 'flv', 'wmv', 'm4v'] }],
    });
    if (!selected || typeof selected !== 'string') return null;
    const fileName = selected.split(/[\\/]/).pop() || 'file';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'mp4';
    const mimeMap: Record<string, string> = {
      mp4: 'video/mp4',
      mov: 'video/quicktime',
      avi: 'video/x-msvideo',
      mkv: 'video/x-matroska',
      webm: 'video/webm',
      flv: 'video/x-flv',
      wmv: 'video/x-ms-wmv',
      m4v: 'video/x-m4v',
    };
    const bytes = await readFile(selected);
    return new File([bytes], fileName, { type: mimeMap[ext] || 'video/mp4' });
  }

  async function selectImageFileNative(): Promise<File | null> {
    const { open } = await import('@tauri-apps/plugin-dialog');
    const selected = await open({
      multiple: false,
      filters: [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }],
    });
    if (!selected || typeof selected !== 'string') return null;
    const fileName = selected.split(/[\\/]/).pop() || 'file';
    const ext = fileName.split('.').pop()?.toLowerCase() || 'png';
    const mimeMap: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      webp: 'image/webp',
      gif: 'image/gif',
    };
    const bytes = await readFile(selected);
    return new File([bytes], fileName, { type: mimeMap[ext] || 'image/png' });
  }

  async function extractVideoMetadata(
    videoBlob: Blob
  ): Promise<{ duration: number | null; width: number | null; height: number | null; thumbnail: File | null }> {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      const timeout = setTimeout(() => resolve({ duration: null, width: null, height: null, thumbnail: null }), 10000);
      video.onloadedmetadata = () => {
        video.currentTime = 1;
        video.onseeked = () => {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          canvas.getContext('2d')?.drawImage(video, 0, 0);
          canvas.toBlob(
            (blob) => {
              const thumbnail = blob ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null;
              resolve({
                duration: video.duration || null,
                width: video.videoWidth || null,
                height: video.videoHeight || null,
                thumbnail,
              });
              URL.revokeObjectURL(video.src);
            },
            'image/jpeg',
            0.8
          );
        };
      };
      video.onerror = () => {
        clearTimeout(timeout);
        resolve({ duration: null, width: null, height: null, thumbnail: null });
      };
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

  function openWatermarkPositionPicker() {
    if (!freeTierBranding.value.watermark_id) return;
    showWatermarkPositionPicker.value = true;
  }

  function saveWatermarkPosition(settings: CreatorWatermarkSettings) {
    freeTierBranding.value.watermark_settings = settings;
    showWatermarkPositionPicker.value = false;
  }

  function saveIntroSettings(settings: RatioAssetMap) {
    freeTierBranding.value.intro_settings = settings;
    showIntroRatioPicker.value = false;
  }

  function saveOutroSettings(settings: RatioAssetMap) {
    freeTierBranding.value.outro_settings = settings;
    showOutroRatioPicker.value = false;
  }

  async function handleWatermarkUpload() {
    if (uploadingWatermark.value) return;
    const orgId = adminOrgId.value;
    if (!orgId) {
      error('No organization', 'Admin account must own an organization to upload assets');
      return;
    }
    uploadingWatermark.value = true;
    try {
      const file = await selectImageFileNative();
      if (!file) return;
      const dimensions = await extractImageDimensions(file);
      const response = await uploadOrganizationAsset(orgId, file, 'watermark', {
        name: file.name.replace(/\.[^/.]+$/, ''),
        width: dimensions.width ?? undefined,
        height: dimensions.height ?? undefined,
      });
      if (response.success && response.asset) {
        orgAssets.value.push(response.asset);
        freeTierBranding.value.watermark_id = `org-asset-${response.asset.id}`;
        success('Watermark uploaded', `"${response.asset.name}" has been uploaded successfully`);
      } else {
        error('Upload failed', response.error || 'Failed to upload watermark');
      }
    } catch (err: any) {
      console.error('[AdminSettings] Watermark upload failed:', err);
      error('Upload failed', err.message || 'Failed to upload watermark');
    } finally {
      uploadingWatermark.value = false;
    }
  }

  async function handleIntroUpload() {
    if (uploadingIntro.value) return;
    const orgId = adminOrgId.value;
    if (!orgId) {
      error('No organization', 'Admin account must own an organization to upload assets');
      return;
    }
    uploadingIntro.value = true;
    try {
      const file = await selectVideoFileNative();
      if (!file) return;
      const metadata = await extractVideoMetadata(file);
      const response = await uploadOrganizationAsset(orgId, file, 'intro', {
        name: file.name.replace(/\.[^/.]+$/, ''),
        thumbnail: metadata.thumbnail ?? undefined,
        duration: metadata.duration ?? undefined,
        width: metadata.width ?? undefined,
        height: metadata.height ?? undefined,
      });
      if (response.success && response.asset) {
        orgAssets.value.push(response.asset);
        const assetId = `org-asset-${response.asset.id}`;
        freeTierBranding.value.intro_settings = {
          '16:9': { assetId },
          '9:16': { assetId },
          '1:1': { assetId },
          '4:5': { assetId },
        };
        success('Intro uploaded', `"${response.asset.name}" has been uploaded successfully`);
      } else {
        error('Upload failed', response.error || 'Failed to upload intro');
      }
    } catch (err: any) {
      console.error('[AdminSettings] Intro upload failed:', err);
      error('Upload failed', err.message || 'Failed to upload intro');
    } finally {
      uploadingIntro.value = false;
    }
  }

  async function handleOutroUpload() {
    if (uploadingOutro.value) return;
    const orgId = adminOrgId.value;
    if (!orgId) {
      error('No organization', 'Admin account must own an organization to upload assets');
      return;
    }
    uploadingOutro.value = true;
    try {
      const file = await selectVideoFileNative();
      if (!file) return;
      const metadata = await extractVideoMetadata(file);
      const response = await uploadOrganizationAsset(orgId, file, 'outro', {
        name: file.name.replace(/\.[^/.]+$/, ''),
        thumbnail: metadata.thumbnail ?? undefined,
        duration: metadata.duration ?? undefined,
        width: metadata.width ?? undefined,
        height: metadata.height ?? undefined,
      });
      if (response.success && response.asset) {
        orgAssets.value.push(response.asset);
        const assetId = `org-asset-${response.asset.id}`;
        freeTierBranding.value.outro_settings = {
          '16:9': { assetId },
          '9:16': { assetId },
          '1:1': { assetId },
          '4:5': { assetId },
        };
        success('Outro uploaded', `"${response.asset.name}" has been uploaded successfully`);
      } else {
        error('Upload failed', response.error || 'Failed to upload outro');
      }
    } catch (err: any) {
      console.error('[AdminSettings] Outro upload failed:', err);
      error('Upload failed', err.message || 'Failed to upload outro');
    } finally {
      uploadingOutro.value = false;
    }
  }

  async function saveFreeTierBranding() {
    savingBranding.value = true;
    try {
      await api.put('/admin/free-tier-branding', {
        branding: {
          watermark_id: freeTierBranding.value.watermark_id,
          watermark_settings: freeTierBranding.value.watermark_settings,
          intro_settings: freeTierBranding.value.intro_settings,
          outro_settings: freeTierBranding.value.outro_settings,
        },
      });
      success('Branding saved', 'Free tier branding settings have been updated');
    } catch (err) {
      console.error('[AdminSettings] Failed to save free tier branding:', err);
      error('Save failed', 'Failed to save free tier branding settings');
    } finally {
      savingBranding.value = false;
    }
  }

  onMounted(() => {
    fetchFeatureFlags();
    loadPlatformOverride();
    loadFreeTierBranding();
    loadAssets();
  });
</script>
