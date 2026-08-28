import type { ApiClient } from './createApiClient';

export type UserAssetType = 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay';

export interface ServerUserAsset {
  id: number;
  user_id: number;
  asset_type: UserAssetType;
  name: string;
  url: string;
  thumbnail_url: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  content_hash: string | null;
  inserted_at: string;
  updated_at: string;
}

export type UserCreatorProfileScope = 'streamer' | 'global' | 'personal_studio';

export interface ServerUserCreatorProfile {
  id: number;
  user_id: number;
  client_id: string | null;
  name: string;
  description: string | null;
  profile_image_url: string | null;
  intro_id: number | null;
  outro_id: number | null;
  watermark_id: number | null;
  watermark_settings: Record<string, unknown> | null;
  intro_outro_settings: Record<string, unknown> | null;
  intro_ratio_settings: string | null;
  outro_ratio_settings: string | null;
  layout_overlays: Record<string, unknown>[];
  scope: UserCreatorProfileScope;
  disabled: boolean;
  clip_build_defaults: Record<string, unknown> | null;
  inserted_at: string;
  updated_at: string;
}

export interface UserBrandingBundleResponse {
  success: boolean;
  assets: ServerUserAsset[];
  profiles: ServerUserCreatorProfile[];
  error?: string;
}

export interface UserAssetsResponse {
  success: boolean;
  assets: ServerUserAsset[];
  asset?: ServerUserAsset;
  error?: string;
}

export interface UserCreatorProfilesResponse {
  success: boolean;
  profiles?: ServerUserCreatorProfile[];
  profile?: ServerUserCreatorProfile;
  error?: string;
}

export type ReactNativeUploadFile = {
  uri: string;
  name: string;
  type: string;
};

export function createUserBrandingApi(client: ApiClient) {
  return {
    getBundle() {
      return client.get<UserBrandingBundleResponse>('/user/branding');
    },

    listAssets(assetType?: UserAssetType) {
      const query = assetType ? `?asset_type=${encodeURIComponent(assetType)}` : '';
      return client.get<UserAssetsResponse>(`/user/assets${query}`);
    },

    async uploadAsset(input: {
      file: Blob | File | ReactNativeUploadFile;
      assetType: UserAssetType;
      name?: string;
      thumbnail?: Blob | File | ReactNativeUploadFile;
      duration?: number;
      width?: number;
      height?: number;
    }) {
      const form = new FormData();
      form.append('asset_type', input.assetType);
      if (input.name) form.append('name', input.name);
      if (input.duration != null) form.append('duration', String(input.duration));
      if (input.width != null) form.append('width', String(input.width));
      if (input.height != null) form.append('height', String(input.height));
      form.append('file', input.file as Blob);
      if (input.thumbnail) form.append('thumbnail', input.thumbnail as Blob);
      return client.post<UserAssetsResponse>('/user/assets', form);
    },

    deleteAsset(id: number) {
      return client.delete<{ success: boolean; error?: string }>(`/user/assets/${id}`);
    },

    listProfiles() {
      return client.get<UserCreatorProfilesResponse>('/user/creator-profiles');
    },

    upsertProfile(body: Partial<ServerUserCreatorProfile> & { name: string; client_id?: string }) {
      return client.post<UserCreatorProfilesResponse>('/user/creator-profiles', body);
    },

    updateProfile(id: number, body: Partial<ServerUserCreatorProfile>) {
      return client.put<UserCreatorProfilesResponse>(`/user/creator-profiles/${id}`, body);
    },

    deleteProfile(id: number) {
      return client.delete<{ success: boolean; error?: string }>(`/user/creator-profiles/${id}`);
    },
  };
}

export type UserBrandingApi = ReturnType<typeof createUserBrandingApi>;
