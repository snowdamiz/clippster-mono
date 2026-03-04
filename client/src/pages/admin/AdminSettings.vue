<template>
  <PageLayout
    title="Settings"
    description="Feature flags and UI configuration"
    :show-header="true"
    :icon="Settings"
    :breadcrumbs="[{ label: 'Admin', path: '/admin' }, { label: 'Settings' }]"
  >
    <div class="admin-settings">
      <!-- Page Heading -->
      <div class="admin-settings__heading">
        <h1 class="admin-settings__title">Settings</h1>
        <p class="admin-settings__subtitle">Feature flags and UI configuration</p>
      </div>

      <!-- Feature Flags -->
      <div class="admin-settings__section">
        <div class="admin-settings__section-header">
          <h3 class="admin-settings__section-title">Feature Flags</h3>
          <p class="admin-settings__section-desc">
            Enable or disable features across the application. Changes take effect immediately for all users.
          </p>
        </div>

        <div class="admin-settings__flags">
          <!-- Live Clip Feature Toggle -->
          <div class="admin-settings__flag">
            <div class="admin-settings__flag-info">
              <div class="admin-settings__flag-icon admin-settings__flag-icon--violet">
                <Radio class="admin-settings__flag-icon-svg" />
              </div>
              <div>
                <span class="admin-settings__flag-name">Live Clip</span>
                <p class="admin-settings__flag-desc">
                  Enable real-time stream monitoring, recording, and clip detection features.
                </p>
              </div>
            </div>
            <div class="admin-settings__flag-control">
              <span v-if="featureFlagsLoading" class="admin-settings__flag-loading">
                <Loader2 class="admin-settings__flag-loading-icon" />
                Loading...
              </span>
              <button
                class="admin-settings__toggle"
                :class="{ 'admin-settings__toggle--active': isLiveClipEnabled }"
                :disabled="featureFlagsLoading || updatingLiveClipFlag"
                role="switch"
                :aria-checked="isLiveClipEnabled"
                @click="toggleLiveClipFeature"
              >
                <span
                  class="admin-settings__toggle-thumb"
                  :class="{ 'admin-settings__toggle-thumb--active': isLiveClipEnabled }"
                />
              </button>
            </div>
          </div>

          <div v-if="!isLiveClipEnabled" class="admin-settings__flag-warning">
            <p>
              <strong>Live Clip is disabled.</strong>
              The Live Clip page and monitoring controls are hidden from all users.
            </p>
          </div>

          <!-- Beta Mode Toggle -->
          <div class="admin-settings__flag">
            <div class="admin-settings__flag-info">
              <div class="admin-settings__flag-icon admin-settings__flag-icon--amber">
                <KeyRound class="admin-settings__flag-icon-svg" />
              </div>
              <div>
                <span class="admin-settings__flag-name">Beta Mode</span>
                <p class="admin-settings__flag-desc">
                  Require new users to enter a beta code before accessing the app.
                </p>
              </div>
            </div>
            <div class="admin-settings__flag-control">
              <span v-if="featureFlagsLoading" class="admin-settings__flag-loading">
                <Loader2 class="admin-settings__flag-loading-icon" />
                Loading...
              </span>
              <button
                class="admin-settings__toggle"
                :class="{ 'admin-settings__toggle--active admin-settings__toggle--amber': isBetaModeEnabled }"
                :disabled="featureFlagsLoading || updatingBetaModeFlag"
                role="switch"
                :aria-checked="isBetaModeEnabled"
                @click="toggleBetaModeFeature"
              >
                <span
                  class="admin-settings__toggle-thumb"
                  :class="{ 'admin-settings__toggle-thumb--active': isBetaModeEnabled }"
                />
              </button>
            </div>
          </div>

          <div v-if="isBetaModeEnabled" class="admin-settings__flag-warning admin-settings__flag-warning--amber">
            <p>
              <strong>Beta Mode is enabled.</strong>
              New users must enter a valid beta code to access the app. Generate codes in the Beta Codes page.
            </p>
          </div>
        </div>
      </div>

      <!-- Platform Override Controls -->
      <div class="admin-settings__section">
        <div class="admin-settings__section-header">
          <h3 class="admin-settings__section-title">TitleBar Platform Override</h3>
          <p class="admin-settings__section-desc">
            Force the TitleBar component to render as if running on a specific operating system. This allows testing
            platform-specific styling without switching environments.
          </p>
        </div>

        <div class="admin-settings__platforms">
          <button
            v-for="platform in ['auto', 'windows', 'macos', 'linux']"
            :key="platform"
            class="admin-settings__platform-btn"
            :class="{ 'admin-settings__platform-btn--active': titleBarPlatformOverride === platform }"
            @click="setTitleBarOverride(platform)"
          >
            <Check v-if="titleBarPlatformOverride === platform" class="admin-settings__platform-check" />
            {{ getPlatformDisplayName(platform) }}
          </button>
        </div>

        <div v-if="titleBarPlatformOverride !== 'auto'" class="admin-settings__platform-notice">
          <p>
            <strong>Active Override:</strong>
            TitleBar is rendering as {{ getPlatformDisplayName(titleBarPlatformOverride) }} style.
            <button class="admin-settings__platform-reset" @click="setTitleBarOverride('auto')">Reset to auto</button>
          </p>
        </div>
      </div>

      <!-- Leaderboard Management Section -->
      <div class="admin-settings__section">
        <div class="admin-settings__section-header">
          <h3 class="admin-settings__section-title">Leaderboard Management</h3>
          <p class="admin-settings__section-desc">
            Manually trigger leaderboard recalculation. Normally runs automatically on Monday (weekly) and the 1st of each month (monthly). Use this to populate data immediately without waiting for the scheduled run.
          </p>
        </div>

        <div class="admin-settings__leaderboard">
          <div class="admin-settings__leaderboard-status">
            <div class="admin-settings__leaderboard-indicator">
              <Trophy :size="14" />
            </div>
            <div>
              <span class="admin-settings__branding-label">Scheduled Recalculation</span>
              <p class="admin-settings__branding-hint">Weekly: every Monday 00:00 UTC &nbsp;·&nbsp; Monthly: 1st of month 00:00 UTC</p>
            </div>
          </div>

          <div class="admin-settings__leaderboard-actions">
            <button
              class="admin-settings__lb-btn admin-settings__lb-btn--weekly"
              :disabled="refreshingLeaderboard !== null"
              @click="refreshLeaderboard('weekly')"
            >
              <Loader2 v-if="refreshingLeaderboard === 'weekly'" :size="14" class="admin-settings__flag-loading-icon" />
              <RefreshCw v-else :size="14" />
              {{ refreshingLeaderboard === 'weekly' ? 'Refreshing...' : 'Refresh Weekly' }}
            </button>
            <button
              class="admin-settings__lb-btn admin-settings__lb-btn--monthly"
              :disabled="refreshingLeaderboard !== null"
              @click="refreshLeaderboard('monthly')"
            >
              <Loader2 v-if="refreshingLeaderboard === 'monthly'" :size="14" class="admin-settings__flag-loading-icon" />
              <RefreshCw v-else :size="14" />
              {{ refreshingLeaderboard === 'monthly' ? 'Refreshing...' : 'Refresh Monthly' }}
            </button>
            <button
              class="admin-settings__lb-btn admin-settings__lb-btn--both"
              :disabled="refreshingLeaderboard !== null"
              @click="refreshLeaderboard('both')"
            >
              <Loader2 v-if="refreshingLeaderboard === 'both'" :size="14" class="admin-settings__flag-loading-icon" />
              <RefreshCw v-else :size="14" />
              {{ refreshingLeaderboard === 'both' ? 'Refreshing...' : 'Refresh Both' }}
            </button>
          </div>

          <div v-if="leaderboardRefreshResult" class="admin-settings__lb-result" :class="{ 'admin-settings__lb-result--success': leaderboardRefreshResult.success, 'admin-settings__lb-result--error': !leaderboardRefreshResult.success }">
            <Check v-if="leaderboardRefreshResult.success" :size="14" />
            <span>{{ leaderboardRefreshResult.message }}</span>
          </div>
        </div>
      </div>

      <!-- Free Tier Branding Section -->
      <div class="admin-settings__section">
        <div class="admin-settings__section-header">
          <h3 class="admin-settings__section-title">Free Tier Branding</h3>
          <p class="admin-settings__section-desc">
            Configure the watermark, intro, and outro that are automatically applied to all free tier user outputs.
            Free tier users cannot override these settings.
          </p>
        </div>

        <div class="admin-settings__branding">
          <div class="admin-settings__branding-status">
            <div class="admin-settings__branding-indicator" :class="{ 'admin-settings__branding-indicator--active': freeTierBrandingConfigured }">
              <Check v-if="freeTierBrandingConfigured" :size="14" />
              <ImageIcon v-else :size="14" />
            </div>
            <div>
              <span class="admin-settings__branding-label">
                {{ freeTierBrandingConfigured ? 'Branding Configured' : 'No Branding Set' }}
              </span>
              <p class="admin-settings__branding-hint">
                {{ freeTierBrandingConfigured
                  ? 'Free tier outputs will include admin watermark/intro/outro'
                  : 'Free tier outputs will not have any branding applied'
                }}
              </p>
            </div>
          </div>

          <div class="admin-settings__branding-fields">
            <!-- Watermark Selection -->
            <div class="admin-settings__asset-row">
              <label class="admin-settings__asset-label">Watermark</label>
              <div class="admin-settings__asset-controls">
                <div class="admin-settings__asset-info">
                  <div class="admin-settings__asset-icon admin-settings__asset-icon--watermark">
                    <ImageIconLucide :size="14" />
                  </div>
                  <span class="admin-settings__asset-name">
                    {{ selectedWatermark?.name || 'No watermark selected' }}
                  </span>
                </div>
                <button
                  type="button"
                  @click="openWatermarkPositionPicker"
                  :disabled="!freeTierBranding.watermark_id"
                  class="admin-settings__asset-btn"
                  :class="{ 'admin-settings__asset-btn--active': watermarkConfiguredRatios > 0 }"
                  title="Configure watermark position"
                >
                  <Settings2 :size="16" />
                </button>
                <button
                  type="button"
                  @click="handleWatermarkUpload"
                  :disabled="uploadingWatermark"
                  class="admin-settings__asset-btn"
                  title="Upload new watermark"
                >
                  <Loader2 v-if="uploadingWatermark" :size="16" class="admin-settings__flag-loading-icon" />
                  <Upload v-else :size="16" />
                </button>
              </div>
              <p v-if="watermarkConfiguredRatios > 0" class="admin-settings__asset-hint">
                <Settings2 :size="12" />
                Position configured for {{ watermarkConfiguredRatios }} aspect ratio(s)
              </p>
            </div>

            <!-- Intro Selection -->
            <div class="admin-settings__asset-row">
              <label class="admin-settings__asset-label">Intro</label>
              <div class="admin-settings__asset-controls">
                <div class="admin-settings__asset-info">
                  <div class="admin-settings__asset-icon admin-settings__asset-icon--intro">
                    <Play :size="14" />
                  </div>
                  <span class="admin-settings__asset-name">
                    {{ selectedIntroName || (introConfiguredRatios > 0 ? `${introConfiguredRatios} ratio(s) configured` : 'No intro configured') }}
                  </span>
                </div>
                <button
                  type="button"
                  @click="showIntroRatioPicker = true"
                  class="admin-settings__asset-btn"
                  :class="{ 'admin-settings__asset-btn--active': introConfiguredRatios > 0 }"
                  title="Configure intro per aspect ratio"
                >
                  <Settings2 :size="16" />
                </button>
                <button
                  type="button"
                  @click="handleIntroUpload"
                  :disabled="uploadingIntro"
                  class="admin-settings__asset-btn"
                  title="Upload new intro"
                >
                  <Loader2 v-if="uploadingIntro" :size="16" class="admin-settings__flag-loading-icon" />
                  <Upload v-else :size="16" />
                </button>
              </div>
              <p v-if="introConfiguredRatios > 0" class="admin-settings__asset-hint">
                <Settings2 :size="12" />
                Per-ratio intros configured
              </p>
            </div>

            <!-- Outro Selection -->
            <div class="admin-settings__asset-row">
              <label class="admin-settings__asset-label">Outro</label>
              <div class="admin-settings__asset-controls">
                <div class="admin-settings__asset-info">
                  <div class="admin-settings__asset-icon admin-settings__asset-icon--outro">
                    <SkipForward :size="14" />
                  </div>
                  <span class="admin-settings__asset-name">
                    {{ selectedOutroName || (outroConfiguredRatios > 0 ? `${outroConfiguredRatios} ratio(s) configured` : 'No outro configured') }}
                  </span>
                </div>
                <button
                  type="button"
                  @click="showOutroRatioPicker = true"
                  class="admin-settings__asset-btn"
                  :class="{ 'admin-settings__asset-btn--active': outroConfiguredRatios > 0 }"
                  title="Configure outro per aspect ratio"
                >
                  <Settings2 :size="16" />
                </button>
                <button
                  type="button"
                  @click="handleOutroUpload"
                  :disabled="uploadingOutro"
                  class="admin-settings__asset-btn"
                  title="Upload new outro"
                >
                  <Loader2 v-if="uploadingOutro" :size="16" class="admin-settings__flag-loading-icon" />
                  <Upload v-else :size="16" />
                </button>
              </div>
              <p v-if="outroConfiguredRatios > 0" class="admin-settings__asset-hint">
                <Settings2 :size="12" />
                Per-ratio outros configured
              </p>
            </div>
          </div>

          <button
            class="admin-settings__branding-save"
            :disabled="savingBranding"
            @click="saveFreeTierBranding"
          >
            <Loader2 v-if="savingBranding" :size="14" class="admin-settings__flag-loading-icon" />
            <span>{{ savingBranding ? 'Saving...' : 'Save Branding' }}</span>
          </button>
        </div>
      </div>
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
  import { Settings, Radio, KeyRound, Check, Loader2, ImageIcon, Trophy, RefreshCw, Upload, Play, SkipForward, Settings2, Image as ImageIconLucide } from 'lucide-vue-next';
  import api from '@/services/api';
  import PageLayout from '@/components/PageLayout.vue';
  import { useFeatureFlags } from '@/composables/useFeatureFlags';
  import { useToast } from '@/composables/useToast';
  import WatermarkPositionPicker, { type CreatorWatermarkSettings } from '@/components/WatermarkPositionPicker.vue';
  import IntroOutroRatioPicker from '@/components/IntroOutroRatioPicker.vue';
  import type { RatioAssetMap } from '@/services/database/types';
  import { listOrganizationAssets, uploadOrganizationAsset, type ServerOrganizationAsset } from '@/services/organizationAssetsApi';
  import { useAuthStore } from '@/stores/auth';
  import { readFile } from '@tauri-apps/plugin-fs';

  const {
    isLiveClipEnabled,
    isBetaModeEnabled,
    isLoading: featureFlagsLoading,
    fetchFeatureFlags,
    setLiveClipEnabled,
    setBetaModeEnabled,
  } = useFeatureFlags();

  const { success, error } = useToast();
  const authStore = useAuthStore();

  const adminOrgId = computed(() => (authStore.user as any)?.owned_organization_id ?? null);

  const updatingLiveClipFlag = ref(false);
  const updatingBetaModeFlag = ref(false);
  const titleBarPlatformOverride = ref<string>('auto');

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
        return 'Auto Detect';
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
    return orgAssets.value.find(a => a.id === sid);
  });
  const selectedIntroName = computed(() => {
    const introSettings = freeTierBranding.value.intro_settings;
    if (!introSettings) return null;
    const firstEntry = Object.values(introSettings).find((v): v is { assetId: string } => v !== null && v !== undefined);
    if (!firstEntry) return null;
    const sid = extractServerId(firstEntry.assetId);
    const asset = orgAssets.value.find(a => a.id === sid);
    return asset?.name ?? null;
  });
  const selectedOutroName = computed(() => {
    const outroSettings = freeTierBranding.value.outro_settings;
    if (!outroSettings) return null;
    const firstEntry = Object.values(outroSettings).find((v): v is { assetId: string } => v !== null && v !== undefined);
    if (!firstEntry) return null;
    const sid = extractServerId(firstEntry.assetId);
    const asset = orgAssets.value.find(a => a.id === sid);
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
      setTimeout(() => { leaderboardRefreshResult.value = null; }, 5000);
    }
  }

  const freeTierBrandingConfigured = computed(() => {
    const hasWatermark = !!freeTierBranding.value.watermark_id;
    const hasIntro = !!freeTierBranding.value.intro_settings && Object.values(freeTierBranding.value.intro_settings).some(v => v !== null);
    const hasOutro = !!freeTierBranding.value.outro_settings && Object.values(freeTierBranding.value.outro_settings).some(v => v !== null);
    return hasWatermark || hasIntro || hasOutro;
  });
  
  const watermarkConfiguredRatios = computed(() => {
    if (!freeTierBranding.value.watermark_settings) return 0;
    return Object.values(freeTierBranding.value.watermark_settings).filter(v => v !== null).length;
  });
  
  const introConfiguredRatios = computed(() => {
    if (!freeTierBranding.value.intro_settings) return 0;
    return Object.values(freeTierBranding.value.intro_settings).filter(v => v !== null).length;
  });
  
  const outroConfiguredRatios = computed(() => {
    if (!freeTierBranding.value.outro_settings) return 0;
    return Object.values(freeTierBranding.value.outro_settings).filter(v => v !== null).length;
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
      mp4: 'video/mp4', mov: 'video/quicktime', avi: 'video/x-msvideo',
      mkv: 'video/x-matroska', webm: 'video/webm', flv: 'video/x-flv',
      wmv: 'video/x-ms-wmv', m4v: 'video/x-m4v',
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
      png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
      webp: 'image/webp', gif: 'image/gif',
    };
    const bytes = await readFile(selected);
    return new File([bytes], fileName, { type: mimeMap[ext] || 'image/png' });
  }

  async function extractVideoMetadata(videoBlob: Blob): Promise<{ duration: number | null; width: number | null; height: number | null; thumbnail: File | null }> {
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
          canvas.toBlob((blob) => {
            const thumbnail = blob ? new File([blob], 'thumbnail.jpg', { type: 'image/jpeg' }) : null;
            resolve({ duration: video.duration || null, width: video.videoWidth || null, height: video.videoHeight || null, thumbnail });
            URL.revokeObjectURL(video.src);
          }, 'image/jpeg', 0.8);
        };
      };
      video.onerror = () => { clearTimeout(timeout); resolve({ duration: null, width: null, height: null, thumbnail: null }); };
      video.src = URL.createObjectURL(videoBlob);
    });
  }

  async function extractImageDimensions(imageBlob: Blob): Promise<{ width: number | null; height: number | null }> {
    return new Promise((resolve) => {
      const img = new window.Image();
      img.onload = () => { resolve({ width: img.naturalWidth, height: img.naturalHeight }); URL.revokeObjectURL(img.src); };
      img.onerror = () => { resolve({ width: null, height: null }); URL.revokeObjectURL(img.src); };
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
    if (!orgId) { error('No organization', 'Admin account must own an organization to upload assets'); return; }
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
    if (!orgId) { error('No organization', 'Admin account must own an organization to upload assets'); return; }
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
    if (!orgId) { error('No organization', 'Admin account must own an organization to upload assets'); return; }
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
        }
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

<style scoped>
  .admin-settings {
    display: flex;
    flex-direction: column;
    gap: 1.5rem;
    padding: 1.5rem;
    max-width: 1000px;
    margin: 0 auto;
    width: 100%;
  }

  .admin-settings__heading {
    margin-bottom: 0.5rem;
  }

  .admin-settings__title {
    font-size: 1.5rem;
    font-weight: 700;
    color: var(--sidebar-text);
    margin: 0 0 0.2rem;
    letter-spacing: -0.02em;
  }

  .admin-settings__subtitle {
    font-size: 0.875rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-settings__header {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 1rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-settings__header-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: linear-gradient(135deg, rgba(100, 116, 139, 0.2) 0%, rgba(71, 85, 105, 0.2) 100%);
    border: 1px solid rgba(100, 116, 139, 0.3);
  }

  .admin-settings__header-icon-svg {
    width: 20px;
    height: 20px;
    color: #94a3b8;
  }

  .admin-settings__header-title {
    font-size: 1.125rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0;
  }
  .admin-settings__header-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-settings__section {
    padding: 1.25rem;
    background-color: var(--sidebar-surface);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-settings__section-header {
    margin-bottom: 1rem;
  }

  .admin-settings__section-title {
    font-size: 0.875rem;
    font-weight: 600;
    color: var(--sidebar-text);
    margin: 0 0 0.5rem;
  }

  .admin-settings__section-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0;
  }

  .admin-settings__flags {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .admin-settings__flag {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 1rem;
    background-color: rgba(24, 24, 27, 0.6);
    border: 1px solid var(--sidebar-border);
    border-radius: 10px;
  }

  .admin-settings__flag-info {
    display: flex;
    align-items: flex-start;
    gap: 0.5rem;
    flex: 1;
  }

  .admin-settings__flag-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .admin-settings__flag-icon--violet {
    background: linear-gradient(135deg, rgba(139, 92, 246, 0.2) 0%, rgba(168, 85, 247, 0.2) 100%);
    border: 1px solid rgba(139, 92, 246, 0.3);
  }
  .admin-settings__flag-icon--violet .admin-settings__flag-icon-svg {
    color: #a78bfa;
  }

  .admin-settings__flag-icon--amber {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(249, 115, 22, 0.2) 100%);
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  .admin-settings__flag-icon--amber .admin-settings__flag-icon-svg {
    color: #fbbf24;
  }

  .admin-settings__flag-icon-svg {
    width: 16px;
    height: 16px;
  }

  .admin-settings__flag-name {
    font-weight: 500;
    color: var(--sidebar-text);
  }

  .admin-settings__flag-desc {
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
    margin: 0.5rem 0 0;
  }

  .admin-settings__flag-control {
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .admin-settings__flag-loading {
    display: flex;
    align-items: center;
    gap: 0.25rem;
    font-size: 0.75rem;
    color: var(--sidebar-text-muted);
  }

  .admin-settings__flag-loading-icon {
    width: 12px;
    height: 12px;
    animation: spin 1s linear infinite;
  }

  .admin-settings__toggle {
    position: relative;
    display: inline-flex;
    width: 44px;
    height: 24px;
    flex-shrink: 0;
    cursor: pointer;
    border-radius: 9999px;
    border: 2px solid transparent;
    background-color: rgba(63, 63, 70, 1);
    transition: all 200ms ease;
  }

  .admin-settings__toggle:focus {
    outline: none;
    box-shadow: 0 0 0 2px rgba(139, 92, 246, 0.25);
  }

  .admin-settings__toggle:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-settings__toggle--active {
    background-color: #8b5cf6;
  }

  .admin-settings__toggle--amber.admin-settings__toggle--active {
    background-color: #f59e0b;
  }

  .admin-settings__toggle-thumb {
    pointer-events: none;
    display: inline-block;
    width: 20px;
    height: 20px;
    border-radius: 9999px;
    background-color: white;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
    transition: transform 200ms ease;
  }

  .admin-settings__toggle-thumb--active {
    transform: translateX(20px);
  }

  .admin-settings__flag-warning {
    padding: 0.75rem;
    background-color: rgba(245, 158, 11, 0.1);
    border: 1px solid rgba(245, 158, 11, 0.3);
    border-radius: 10px;
  }

  .admin-settings__flag-warning p {
    font-size: 0.875rem;
    color: #fcd34d;
    margin: 0;
  }

  .admin-settings__flag-warning--amber {
    background-color: rgba(245, 158, 11, 0.1);
    border-color: rgba(245, 158, 11, 0.3);
  }

  .admin-settings__flag-warning--amber p {
    color: #fcd34d;
  }

  .admin-settings__platforms {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .admin-settings__platform-btn {
    display: inline-flex;
    align-items: center;
    padding: 0.5rem 1rem;
    border-radius: 8px;
    font-size: 0.875rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 150ms ease;
    background-color: var(--sidebar-hover);
    color: var(--sidebar-text);
    border: 1px solid var(--sidebar-border);
  }

  .admin-settings__platform-btn:hover {
    background-color: rgba(63, 63, 70, 1);
    color: white;
  }

  .admin-settings__platform-btn--active {
    background: linear-gradient(to right, #2563eb, #4f46e5);
    color: white;
    border-color: rgba(59, 130, 246, 0.3);
  }

  .admin-settings__platform-btn--active:hover {
    opacity: 0.9;
  }

  .admin-settings__platform-check {
    width: 12px;
    height: 12px;
    margin-right: 0.5rem;
  }

  .admin-settings__platform-notice {
    margin-top: 1rem;
    padding: 0.75rem;
    background-color: rgba(59, 130, 246, 0.1);
    border: 1px solid rgba(59, 130, 246, 0.3);
    border-radius: 10px;
  }

  .admin-settings__platform-notice p {
    font-size: 0.875rem;
    color: #93c5fd;
    margin: 0;
  }

  .admin-settings__platform-reset {
    margin-left: 0.5rem;
    color: #60a5fa;
    background: transparent;
    border: none;
    text-decoration: underline;
    cursor: pointer;
    font-size: 0.875rem;
    transition: color 150ms ease;
  }

  .admin-settings__platform-reset:hover {
    color: #bfdbfe;
  }

  /* Leaderboard Management */
  .admin-settings__leaderboard {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .admin-settings__leaderboard-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-settings__leaderboard-indicator {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(245, 158, 11, 0.15);
    color: #fbbf24;
    flex-shrink: 0;
  }

  .admin-settings__leaderboard-actions {
    display: flex;
    flex-wrap: wrap;
    gap: 0.75rem;
  }

  .admin-settings__lb-btn {
    display: inline-flex;
    align-items: center;
    gap: 0.375rem;
    padding: 0.5rem 1rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    border: 1px solid transparent;
  }

  .admin-settings__lb-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-settings__lb-btn--weekly {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
    border-color: rgba(59, 130, 246, 0.3);
  }

  .admin-settings__lb-btn--weekly:hover:not(:disabled) {
    background: rgba(59, 130, 246, 0.25);
  }

  .admin-settings__lb-btn--monthly {
    background: rgba(139, 92, 246, 0.15);
    color: #a78bfa;
    border-color: rgba(139, 92, 246, 0.3);
  }

  .admin-settings__lb-btn--monthly:hover:not(:disabled) {
    background: rgba(139, 92, 246, 0.25);
  }

  .admin-settings__lb-btn--both {
    background: rgba(16, 185, 129, 0.15);
    color: #34d399;
    border-color: rgba(16, 185, 129, 0.3);
  }

  .admin-settings__lb-btn--both:hover:not(:disabled) {
    background: rgba(16, 185, 129, 0.25);
  }

  .admin-settings__lb-result {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    padding: 0.625rem 0.875rem;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
  }

  .admin-settings__lb-result--success {
    background: rgba(16, 185, 129, 0.1);
    border: 1px solid rgba(16, 185, 129, 0.3);
    color: #34d399;
  }

  .admin-settings__lb-result--error {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    color: #f87171;
  }

  /* Free Tier Branding */
  .admin-settings__branding {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .admin-settings__branding-status {
    display: flex;
    align-items: center;
    gap: 0.75rem;
    padding: 0.75rem 1rem;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-settings__branding-indicator {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    background: rgba(100, 116, 139, 0.15);
    color: var(--sidebar-text-muted);
  }

  .admin-settings__branding-indicator--active {
    background: rgba(16, 185, 129, 0.15);
    color: rgb(16, 185, 129);
  }

  .admin-settings__branding-label {
    font-size: 0.8125rem;
    font-weight: 600;
    color: var(--sidebar-text);
  }

  .admin-settings__branding-hint {
    font-size: 0.6875rem;
    color: var(--sidebar-text-muted);
    margin: 2px 0 0;
  }

  .admin-settings__branding-fields {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .admin-settings__asset-row {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
    padding: 0.875rem;
    background: rgba(24, 24, 27, 0.4);
    border: 1px solid var(--sidebar-border);
    border-radius: 8px;
  }

  .admin-settings__asset-label {
    font-size: 0.75rem;
    font-weight: 600;
    color: var(--sidebar-text);
    text-transform: uppercase;
    letter-spacing: 0.05em;
  }

  .admin-settings__asset-controls {
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .admin-settings__asset-info {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    flex: 1;
    min-width: 0;
  }

  .admin-settings__asset-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }

  .admin-settings__asset-icon--watermark {
    background: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
  }

  .admin-settings__asset-icon--intro {
    background: rgba(59, 130, 246, 0.15);
    color: #60a5fa;
  }

  .admin-settings__asset-icon--outro {
    background: rgba(168, 85, 247, 0.15);
    color: #a78bfa;
  }

  .admin-settings__asset-name {
    font-size: 0.8125rem;
    color: var(--sidebar-text);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .admin-settings__asset-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: var(--sidebar-hover);
    border: 1px solid var(--sidebar-border);
    border-radius: 6px;
    color: var(--sidebar-text-muted);
    cursor: pointer;
    transition: all 0.15s;
    flex-shrink: 0;
  }

  .admin-settings__asset-btn:hover:not(:disabled) {
    background: var(--sidebar-active);
    color: var(--sidebar-text);
    border-color: var(--sidebar-accent);
  }

  .admin-settings__asset-btn--active {
    background: rgba(6, 182, 212, 0.15);
    color: var(--sidebar-accent);
    border-color: rgba(6, 182, 212, 0.3);
  }

  .admin-settings__asset-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .admin-settings__asset-hint {
    display: flex;
    align-items: center;
    gap: 0.375rem;
    font-size: 0.6875rem;
    color: var(--sidebar-accent);
    margin: 0;
  }

  .admin-settings__branding-save {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.5rem 1.25rem;
    background: var(--sidebar-accent);
    color: white;
    border: none;
    border-radius: 6px;
    font-size: 0.8125rem;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    align-self: flex-start;
  }

  .admin-settings__branding-save:hover:not(:disabled) {
    filter: brightness(1.1);
  }

  .admin-settings__branding-save:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
</style>
