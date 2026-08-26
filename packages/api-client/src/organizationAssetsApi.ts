import type { ApiClient } from './createApiClient';

export interface ServerOrganizationAsset {
  id: number;
  organization_id: number;
  asset_type: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay';
  name: string;
  url: string;
  thumbnail_url: string | null;
  duration: number | null;
  width: number | null;
  height: number | null;
  file_size: number | null;
  mime_type: string | null;
  organization_name?: string;
  inserted_at: string;
  updated_at: string;
}

export interface ListAssetsResponse {
  success: boolean;
  assets: ServerOrganizationAsset[];
  error?: string;
}

export function createOrganizationAssetsApi(client: ApiClient) {
  return {
    getUserOrganizationAssets() {
      return client.get<ListAssetsResponse>('/user/organization-assets');
    },
  };
}

export type OrganizationAssetsApi = ReturnType<typeof createOrganizationAssetsApi>;
