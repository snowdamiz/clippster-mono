import { ref, readonly } from 'vue';
import api from '@/services/api';
import { featureFlags } from './featureFlagState';

// Feature flags state (shared across all components using this composable)
const {
  isLiveClipEnabled,
  isBetaModeEnabled,
  isAIVideoEnabled,
  isImageEditorEnabled,
  isTokendEnabled,
  isCampaignsEnabled,
  isLoading,
  error,
} = featureFlags;
const lastFetchTime = ref<number | null>(null);

// Cache duration: 5 minutes
const CACHE_DURATION_MS = 5 * 60 * 1000;

/**
 * Composable for managing feature flags fetched from the server.
 * Feature flags are cached and shared across all components.
 */
export function useFeatureFlags() {
  /**
   * Fetch feature flags from the server.
   * Uses caching to avoid excessive API calls.
   */
  async function fetchFeatureFlags(force = false): Promise<void> {
    // Check if we have a recent cached value
    if (!force && lastFetchTime.value) {
      const timeSinceLastFetch = Date.now() - lastFetchTime.value;
      if (timeSinceLastFetch < CACHE_DURATION_MS) {
        return;
      }
    }

    // Avoid concurrent fetches
    if (isLoading.value) {
      return;
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await api.get('/settings/feature-flags', { timeout: 10_000 });

      if (response.data.success) {
        const flags = response.data.feature_flags;
        isLiveClipEnabled.value = flags.live_clip_enabled ?? true;
        isBetaModeEnabled.value = flags.beta_mode_enabled ?? false;
        isAIVideoEnabled.value = flags.ai_video_enabled ?? false;
        isImageEditorEnabled.value = flags.image_editor_enabled ?? false;
        isTokendEnabled.value = flags.tokend_enabled ?? false;
        isCampaignsEnabled.value = flags.campaigns_enabled ?? false;
        lastFetchTime.value = Date.now();
      }
    } catch (err) {
      console.error('[FeatureFlags] Failed to fetch feature flags:', err);
      error.value = err instanceof Error ? err.message : 'Failed to fetch feature flags';
      // Keep the current values on error (don't disable features on network failure)
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Set the Live Clip feature flag (admin only).
   * Makes an API call to update the server-side setting.
   */
  async function setLiveClipEnabled(enabled: boolean): Promise<boolean> {
    try {
      const response = await api.put('/admin/settings/live_clip_enabled', {
        key: 'live_clip_enabled',
        value: String(enabled),
      });

      if (response.data.success) {
        isLiveClipEnabled.value = enabled;
        lastFetchTime.value = Date.now();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[FeatureFlags] Failed to update live_clip_enabled:', err);
      error.value = err instanceof Error ? err.message : 'Failed to update setting';
      return false;
    }
  }

  /**
   * Set the Beta Mode feature flag (admin only).
   * Makes an API call to update the server-side setting.
   */
  async function setBetaModeEnabled(enabled: boolean): Promise<boolean> {
    try {
      const response = await api.put('/admin/settings/beta_mode_enabled', {
        key: 'beta_mode_enabled',
        value: String(enabled),
      });

      if (response.data.success) {
        isBetaModeEnabled.value = enabled;
        lastFetchTime.value = Date.now();
        return true;
      }
      return false;
    } catch (err) {
      console.error('[FeatureFlags] Failed to update beta_mode_enabled:', err);
      error.value = err instanceof Error ? err.message : 'Failed to update setting';
      return false;
    }
  }

  const rolloutFlags = {
    ai_video_enabled: isAIVideoEnabled,
    image_editor_enabled: isImageEditorEnabled,
    tokend_enabled: isTokendEnabled,
    campaigns_enabled: isCampaignsEnabled,
  } as const;

  type RolloutFlagKey = keyof typeof rolloutFlags;

  async function setRolloutFlag(key: RolloutFlagKey, enabled: boolean): Promise<boolean> {
    try {
      const response = await api.put(`/admin/settings/${key}`, {
        key,
        value: String(enabled),
      });

      if (!response.data.success) return false;

      rolloutFlags[key].value = enabled;
      lastFetchTime.value = Date.now();
      return true;
    } catch (err) {
      console.error(`[FeatureFlags] Failed to update ${key}:`, err);
      error.value = err instanceof Error ? err.message : 'Failed to update setting';
      return false;
    }
  }

  /**
   * Initialize feature flags by fetching from server.
   * Call this once when the app starts.
   */
  async function initialize(): Promise<void> {
    await fetchFeatureFlags();
  }

  /**
   * Force refresh feature flags from server.
   */
  async function refresh(): Promise<void> {
    await fetchFeatureFlags(true);
  }

  return {
    // State (readonly to prevent direct mutation)
    isLiveClipEnabled: readonly(isLiveClipEnabled),
    isBetaModeEnabled: readonly(isBetaModeEnabled),
    isAIVideoEnabled: readonly(isAIVideoEnabled),
    isImageEditorEnabled: readonly(isImageEditorEnabled),
    isTokendEnabled: readonly(isTokendEnabled),
    isCampaignsEnabled: readonly(isCampaignsEnabled),
    isLoading: readonly(isLoading),
    error: readonly(error),

    // Actions
    initialize,
    refresh,
    fetchFeatureFlags,
    setLiveClipEnabled,
    setBetaModeEnabled,
    setRolloutFlag,
  };
}

export { featureFlags } from './featureFlagState';
