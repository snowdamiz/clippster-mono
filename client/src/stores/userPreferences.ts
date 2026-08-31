import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import {
  type UserPreferences,
  DEFAULT_PREFERENCES,
  getLocalPreferences,
  saveLocalPreferences,
} from '@/services/database/user-preferences';

function normalizeApiOrigin(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, '');
  return trimmed.toLowerCase().endsWith('/api') ? trimmed.slice(0, -4) : trimmed;
}

const API_BASE = normalizeApiOrigin(import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://127.0.0.1:4000' : 'https://api.clippster.app'));

export type ToastCategory =
  | 'livestream'
  | 'clips'
  | 'downloads'
  | 'projects'
  | 'social'
  | 'organization'
  | 'system'
  | 'campaigns';

export const useUserPreferencesStore = defineStore('userPreferences', () => {
  // State
  const preferences = ref<UserPreferences>({ ...DEFAULT_PREFERENCES });
  const loaded = ref(false);
  /** True after at least one server preferences sync this session */
  const syncedFromServer = ref(false);
  const saving = ref(false);

  // Getters
  const timeFormat = computed(() => preferences.value.time_format_preference);
  const is24Hour = computed(() => preferences.value.time_format_preference === '24hr');
  const toastEnabled = computed(() => preferences.value.toast_enabled);
  const toastDuration = computed(() => preferences.value.toast_duration);
  const toastPosition = computed(() => preferences.value.toast_position);
  const toastSoundEnabled = computed(() => preferences.value.toast_sound_enabled);
  const toastBackgroundEnabled = computed(() => preferences.value.toast_background_enabled);

  /**
   * Check if a specific toast category is enabled.
   */
  function isCategoryEnabled(category: ToastCategory): boolean {
    if (!preferences.value.toast_enabled) return false;

    switch (category) {
      case 'livestream':
        return preferences.value.notify_livestream;
      case 'clips':
        return preferences.value.notify_clips;
      case 'downloads':
        return preferences.value.notify_downloads;
      case 'projects':
        return preferences.value.notify_projects;
      case 'social':
        return preferences.value.notify_social;
      case 'organization':
        return preferences.value.notify_organization;
      case 'system':
        return preferences.value.notify_system;
      default:
        return true;
    }
  }

  /**
   * Load preferences from local SQLite cache.
   * Called on app startup after auth.
   */
  async function loadFromLocal(userId: string): Promise<void> {
    try {
      const local = await getLocalPreferences(userId);
      preferences.value = local;
      loaded.value = true;
    } catch (error) {
      console.error('[UserPreferences] Failed to load local preferences:', error);
      preferences.value = { ...DEFAULT_PREFERENCES };
      loaded.value = true;
    }
  }

  /**
   * Sync preferences from server response (e.g., from /auth/me).
   * Saves to local cache as well.
   */
  async function syncFromServer(userId: string, serverPrefs: Partial<UserPreferences>): Promise<void> {
    try {
      const merged = { ...DEFAULT_PREFERENCES, ...serverPrefs };
      preferences.value = merged;
      loaded.value = true;
      syncedFromServer.value = true;
      await saveLocalPreferences(userId, merged);
    } catch (error) {
      console.error('[UserPreferences] Failed to sync from server:', error);
      // Still mark synced so we don't block the tour forever offline
      syncedFromServer.value = true;
    }
  }

  /**
   * Fetch preferences from the API if we haven't synced yet this session.
   * Falls back to local cache on network failure so tours can still run once.
   */
  async function ensureSyncedFromServer(userId: string, token: string): Promise<void> {
    if (syncedFromServer.value) return;
    try {
      const response = await fetch(`${API_BASE}/api/user/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        if (data.preferences) {
          await syncFromServer(userId, data.preferences);
          return;
        }
      }
    } catch (error) {
      console.warn('[UserPreferences] ensureSyncedFromServer failed, using local:', error);
    }
    // Offline / empty response — proceed with whatever local prefs we have
    syncedFromServer.value = true;
    loaded.value = true;
  }

  /**
   * Update a single preference and save to both local and server.
   */
  async function updatePreference<K extends keyof UserPreferences>(
    key: K,
    value: UserPreferences[K],
    userId: string,
    token: string
  ): Promise<boolean> {
    const oldValue = preferences.value[key];
    // Optimistic update
    preferences.value[key] = value;

    try {
      saving.value = true;

      // Save locally first
      await saveLocalPreferences(userId, { [key]: value });

      // Sync to server
      const response = await fetch(`${API_BASE}/api/user/preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ [key]: value }),
      });

      if (!response.ok) {
        // Revert on server error
        preferences.value[key] = oldValue;
        await saveLocalPreferences(userId, { [key]: oldValue });
        return false;
      }

      return true;
    } catch (error) {
      console.error('[UserPreferences] Failed to update preference:', key, error);
      // Revert on error
      preferences.value[key] = oldValue;
      try {
        await saveLocalPreferences(userId, { [key]: oldValue });
      } catch {
        // Ignore local save error during revert
      }
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Update multiple preferences at once.
   */
  async function updatePreferences(
    updates: Partial<UserPreferences>,
    userId: string,
    token: string
  ): Promise<boolean> {
    const oldValues: Partial<UserPreferences> = {};
    for (const key of Object.keys(updates) as (keyof UserPreferences)[]) {
      oldValues[key] = preferences.value[key] as any;
      (preferences.value as any)[key] = updates[key];
    }

    try {
      saving.value = true;

      await saveLocalPreferences(userId, updates);

      const response = await fetch(`${API_BASE}/api/user/preferences`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(updates),
      });

      if (!response.ok) {
        // Revert
        for (const key of Object.keys(oldValues) as (keyof UserPreferences)[]) {
          (preferences.value as any)[key] = oldValues[key];
        }
        await saveLocalPreferences(userId, oldValues);
        return false;
      }

      return true;
    } catch (error) {
      console.error('[UserPreferences] Failed to update preferences:', error);
      for (const key of Object.keys(oldValues) as (keyof UserPreferences)[]) {
        (preferences.value as any)[key] = oldValues[key];
      }
      try {
        await saveLocalPreferences(userId, oldValues);
      } catch {
        // Ignore
      }
      return false;
    } finally {
      saving.value = false;
    }
  }

  /**
   * Reset all preferences to defaults.
   */
  async function resetToDefaults(userId: string, token: string): Promise<boolean> {
    return updatePreferences({ ...DEFAULT_PREFERENCES }, userId, token);
  }

  /**
   * Clear state on logout.
   */
  function clear(): void {
    preferences.value = { ...DEFAULT_PREFERENCES };
    loaded.value = false;
    syncedFromServer.value = false;
  }

  return {
    // State
    preferences,
    loaded,
    syncedFromServer,
    saving,

    // Getters
    timeFormat,
    is24Hour,
    toastEnabled,
    toastDuration,
    toastPosition,
    toastSoundEnabled,
    toastBackgroundEnabled,

    // Actions
    isCategoryEnabled,
    loadFromLocal,
    syncFromServer,
    ensureSyncedFromServer,
    updatePreference,
    updatePreferences,
    resetToDefaults,
    clear,
  };
});
