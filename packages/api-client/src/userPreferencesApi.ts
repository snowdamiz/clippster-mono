import type { ApiClient } from './createApiClient';

export interface UserPreferences {
  time_format_preference?: string | null;
  toast_enabled?: boolean;
  toast_duration?: number;
  toast_position?: string | null;
  toast_sound_enabled?: boolean;
  toast_background_enabled?: boolean;
  notify_livestream?: boolean;
  notify_clips?: boolean;
  notify_downloads?: boolean;
  notify_projects?: boolean;
  notify_social?: boolean;
  notify_organization?: boolean;
  notify_system?: boolean;
}

export interface UserPreferencesResponse {
  success: boolean;
  preferences?: UserPreferences;
  error?: string;
}

export function createUserPreferencesApi(client: ApiClient) {
  return {
    get() {
      return client.get<UserPreferencesResponse>('/user/preferences');
    },
    update(prefs: Partial<UserPreferences>) {
      return client.patch<UserPreferencesResponse>('/user/preferences', prefs);
    },
  };
}

export type UserPreferencesApi = ReturnType<typeof createUserPreferencesApi>;
