/**
 * Organization Assets API Service
 * Handles communication with the server for organization asset management.
 */

import api from './api';

// ============================================
// Types
// ============================================

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
  uploaded_by: {
    id: number;
    name: string | null;
    email: string;
  } | null;
  organization_name?: string;
  inserted_at: string;
  updated_at: string;
}

export interface ListAssetsResponse {
  success: boolean;
  assets: ServerOrganizationAsset[];
  error?: string;
}

export interface UploadAssetResponse {
  success: boolean;
  asset?: ServerOrganizationAsset;
  error?: string;
}

export interface DeleteAssetResponse {
  success: boolean;
  error?: string;
}

// ============================================
// API Functions
// ============================================

/**
 * List all assets for an organization.
 */
export async function listOrganizationAssets(
  organizationId: string | number,
  assetType?: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay'
): Promise<ListAssetsResponse> {
  try {
    const params = assetType ? { asset_type: assetType } : {};
    const response = await api.get<ListAssetsResponse>(`/organizations/${organizationId}/assets`, {
      params,
    });
    return response.data;
  } catch (error: any) {
    console.error('[OrgAssetsApi] Failed to list assets:', error);
    return {
      success: false,
      assets: [],
      error: error.response?.data?.error || error.message || 'Failed to list assets',
    };
  }
}

/**
 * Get all organization assets for the current user (across all orgs they belong to).
 * Used for syncing.
 */
export async function getUserOrganizationAssets(): Promise<ListAssetsResponse> {
  try {
    const response = await api.get<ListAssetsResponse>('/user/organization-assets');
    console.log('[OrgAssetsApi] Raw response from /user/organization-assets:', response.data);

    // Handle different response formats
    const data = response.data;

    // If the response has a success field, use it as-is
    if (typeof data.success === 'boolean') {
      return data;
    }

    // If the response is an array directly, wrap it
    if (Array.isArray(data)) {
      return { success: true, assets: data };
    }

    // If the response has an assets array but no success field, assume success
    if (Array.isArray(data.assets)) {
      return { success: true, assets: data.assets };
    }

    // If the response has a data field with assets
    if ((data as any).data && Array.isArray((data as any).data)) {
      return { success: true, assets: (data as any).data };
    }

    console.warn('[OrgAssetsApi] Unexpected response format:', data);
    return { success: true, assets: [] };
  } catch (error: any) {
    console.error('[OrgAssetsApi] Failed to get user organization assets:', error);
    console.error('[OrgAssetsApi] Error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
    });
    return {
      success: false,
      assets: [],
      error: error.response?.data?.error || error.message || 'Failed to get organization assets',
    };
  }
}

/**
 * Upload a new asset to an organization.
 * Admin only.
 */
export async function uploadOrganizationAsset(
  organizationId: string | number,
  file: File,
  assetType: 'intro' | 'outro' | 'watermark' | 'audio' | 'image' | 'overlay',
  options?: {
    name?: string;
    thumbnail?: File;
    duration?: number;
    width?: number;
    height?: number;
  }
): Promise<UploadAssetResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('asset_type', assetType);

    if (options?.name) {
      formData.append('name', options.name);
    }
    if (options?.thumbnail) {
      formData.append('thumbnail', options.thumbnail);
    }
    if (options?.duration !== undefined) {
      formData.append('duration', String(options.duration));
    }
    if (options?.width !== undefined) {
      formData.append('width', String(options.width));
    }
    if (options?.height !== undefined) {
      formData.append('height', String(options.height));
    }

    const response = await api.post<UploadAssetResponse>(
      `/organizations/${organizationId}/assets`,
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
        // Allow longer timeout for file uploads
        timeout: 600000, // 10 minutes
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgAssetsApi] Failed to upload asset:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload asset',
    };
  }
}

/**
 * Update an asset (name only).
 * Admin only.
 */
export async function updateOrganizationAsset(
  organizationId: string | number,
  assetId: number,
  name: string
): Promise<UploadAssetResponse> {
  try {
    const response = await api.put<UploadAssetResponse>(
      `/organizations/${organizationId}/assets/${assetId}`,
      { name }
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgAssetsApi] Failed to update asset:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update asset',
    };
  }
}

/**
 * Delete an asset from an organization.
 * Admin only.
 */
export async function deleteOrganizationAsset(
  organizationId: string | number,
  assetId: number
): Promise<DeleteAssetResponse> {
  try {
    const response = await api.delete<DeleteAssetResponse>(
      `/organizations/${organizationId}/assets/${assetId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgAssetsApi] Failed to delete asset:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete asset',
    };
  }
}

/**
 * Download an asset file from URL.
 * Returns the file as a Blob.
 */
export async function downloadAssetFile(url: string): Promise<{
  success: boolean;
  blob?: Blob;
  error?: string;
}> {
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    const blob = await response.blob();
    return { success: true, blob };
  } catch (error: any) {
    console.error('[OrgAssetsApi] Failed to download asset:', error);
    return {
      success: false,
      error: error.message || 'Failed to download asset',
    };
  }
}
