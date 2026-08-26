import type { ApiClient } from './createApiClient';

export interface ServerOrganizationAssetRef {
  id: number;
  name: string;
  asset_type: string;
  url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
}

export interface ServerOrganizationCreatorProfile {
  id: number;
  organization_id: number;
  organization_name?: string;
  name: string;
  description?: string | null;
  profile_image_url?: string | null;
  intro_id?: number | null;
  outro_id?: number | null;
  watermark_id?: number | null;
  watermark_settings?: Record<string, unknown> | null;
  scope: 'streamer' | 'global';
  disabled: boolean;
  intro: ServerOrganizationAssetRef | null;
  outro: ServerOrganizationAssetRef | null;
  watermark: ServerOrganizationAssetRef | null;
  inserted_at: string;
  updated_at: string;
}

export interface ListProfilesResponse {
  success: boolean;
  profiles: ServerOrganizationCreatorProfile[];
  error?: string;
}

export function createOrganizationProfilesApi(client: ApiClient) {
  return {
    getMyAssignedCreatorProfiles() {
      return client.get<ListProfilesResponse>('/user/assigned-creator-profiles');
    },
  };
}

export type OrganizationProfilesApi = ReturnType<typeof createOrganizationProfilesApi>;
