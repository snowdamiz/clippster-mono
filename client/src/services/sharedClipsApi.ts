/**
 * Shared Clips API Service
 * Handles communication with the server for organization shared clips.
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface BrandingConfig {
  [aspectRatio: string]: {
    watermark_id?: string;
    watermark_settings?: {
      position?: string;
      opacity?: number;
      scale?: number;
      margin?: number;
    };
    intro_id?: string;
    outro_id?: string;
  };
}

export interface SharedClipUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export interface SharedClipRecipient {
  user_id: number;
  user: SharedClipUser | null;
  viewed_at: string | null;
  downloaded_at: string | null;
  posted_at: string | null;
}

export interface SharedClipStats {
  total: number;
  viewed: number;
  downloaded: number;
  posted: number;
}

export interface SharedClip {
  id: number;
  organization_id: number;
  organization_name?: string;
  name: string;
  description: string | null;
  url?: string;
  thumbnail_url: string | null;
  duration: number | null;
  file_size: number | null;
  share_with_all: boolean;
  branding_config: BrandingConfig;
  branding_required: boolean;
  expires_at: string;
  days_until_expiration: number;
  inserted_at: string;
  uploaded_by: SharedClipUser | null;
  stats?: SharedClipStats;
  recipients?: SharedClipRecipient[];
  // Member-specific fields
  viewed_at?: string | null;
  downloaded_at?: string | null;
  posted_at?: string | null;
}

export interface ListSharedClipsResponse {
  success: boolean;
  clips: SharedClip[];
  error?: string;
}

export interface SharedClipResponse {
  success: boolean;
  clip?: SharedClip;
  error?: string;
}

export interface SharedClipStatsResponse {
  success: boolean;
  stats?: SharedClipStats;
  error?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

// ============================================
// Admin API Functions
// ============================================

/**
 * Upload and share a new clip with organization members.
 * Admin only.
 */
export async function createSharedClip(
  organizationId: string | number,
  file: File,
  options: {
    name?: string;
    description?: string;
    duration?: number;
    shareWithAll?: boolean;
    recipientUserIds?: number[];
    brandingConfig?: BrandingConfig;
    brandingRequired?: boolean;
    thumbnail?: File;
  }
): Promise<SharedClipResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    if (options.name) {
      formData.append('name', options.name);
    }
    if (options.description) {
      formData.append('description', options.description);
    }
    if (options.duration !== undefined) {
      formData.append('duration', String(options.duration));
    }
    if (options.shareWithAll !== undefined) {
      formData.append('share_with_all', String(options.shareWithAll));
    }
    if (options.recipientUserIds && options.recipientUserIds.length > 0) {
      formData.append('recipient_user_ids', JSON.stringify(options.recipientUserIds));
    }
    if (options.brandingConfig) {
      formData.append('branding_config', JSON.stringify(options.brandingConfig));
    }
    if (options.brandingRequired !== undefined) {
      formData.append('branding_required', String(options.brandingRequired));
    }
    if (options.thumbnail) {
      formData.append('thumbnail', options.thumbnail);
    }

    const response = await api.post<SharedClipResponse>(
      `/organizations/${organizationId}/shared-clips`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 600000, // 10 minutes for large uploads
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to create shared clip:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create shared clip',
    };
  }
}

/**
 * List all shared clips for an organization.
 * Admin only.
 */
export async function listOrganizationSharedClips(
  organizationId: string | number
): Promise<ListSharedClipsResponse> {
  try {
    const response = await api.get<ListSharedClipsResponse>(
      `/organizations/${organizationId}/shared-clips`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to list shared clips:', error);
    return {
      success: false,
      clips: [],
      error: error.response?.data?.error || error.message || 'Failed to list shared clips',
    };
  }
}

/**
 * Get a single shared clip.
 */
export async function getSharedClip(
  organizationId: string | number,
  clipId: string | number
): Promise<SharedClipResponse> {
  try {
    const response = await api.get<SharedClipResponse>(
      `/organizations/${organizationId}/shared-clips/${clipId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to get shared clip:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get shared clip',
    };
  }
}

/**
 * Update branding configuration for a shared clip.
 * Admin only.
 */
export async function updateSharedClipBranding(
  organizationId: string | number,
  clipId: string | number,
  brandingConfig: BrandingConfig,
  brandingRequired: boolean
): Promise<SharedClipResponse> {
  try {
    const response = await api.put<SharedClipResponse>(
      `/organizations/${organizationId}/shared-clips/${clipId}/branding`,
      {
        branding_config: JSON.stringify(brandingConfig),
        branding_required: brandingRequired,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to update branding:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update branding',
    };
  }
}

/**
 * Delete a shared clip.
 * Admin only.
 */
export async function deleteSharedClip(
  organizationId: string | number,
  clipId: string | number
): Promise<ActionResponse> {
  try {
    const response = await api.delete<ActionResponse>(
      `/organizations/${organizationId}/shared-clips/${clipId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to delete shared clip:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete shared clip',
    };
  }
}

/**
 * Get access statistics for a shared clip.
 * Admin only.
 */
export async function getSharedClipStats(
  organizationId: string | number,
  clipId: string | number
): Promise<SharedClipStatsResponse> {
  try {
    const response = await api.get<SharedClipStatsResponse>(
      `/organizations/${organizationId}/shared-clips/${clipId}/stats`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to get stats:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get stats',
    };
  }
}

// ============================================
// Member API Functions
// ============================================

/**
 * Get all shared clips for the current user across all organizations.
 */
export async function getUserSharedClips(): Promise<ListSharedClipsResponse> {
  try {
    const response = await api.get<ListSharedClipsResponse>('/user/shared-clips');
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to get user shared clips:', error);
    return {
      success: false,
      clips: [],
      error: error.response?.data?.error || error.message || 'Failed to get shared clips',
    };
  }
}

/**
 * Mark a shared clip as viewed.
 */
export async function markSharedClipViewed(clipId: string | number): Promise<ActionResponse> {
  try {
    const response = await api.post<ActionResponse>(`/shared-clips/${clipId}/mark-viewed`);
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to mark as viewed:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark as viewed',
    };
  }
}

/**
 * Mark a shared clip as downloaded.
 */
export async function markSharedClipDownloaded(clipId: string | number): Promise<ActionResponse> {
  try {
    const response = await api.post<ActionResponse>(`/shared-clips/${clipId}/mark-downloaded`);
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to mark as downloaded:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark as downloaded',
    };
  }
}

/**
 * Mark a shared clip as posted.
 */
export async function markSharedClipPosted(clipId: string | number): Promise<ActionResponse> {
  try {
    const response = await api.post<ActionResponse>(`/shared-clips/${clipId}/post`);
    return response.data;
  } catch (error: any) {
    console.error('[SharedClipsApi] Failed to mark as posted:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark as posted',
    };
  }
}

// ============================================
// Utility Functions
// ============================================

/**
 * Download a shared clip file from URL.
 * Returns the file as a Blob.
 */
export async function downloadSharedClipFile(url: string): Promise<{
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
    console.error('[SharedClipsApi] Failed to download clip:', error);
    return {
      success: false,
      error: error.message || 'Failed to download clip',
    };
  }
}

/**
 * Get expiration badge color based on days remaining.
 */
export function getExpirationBadgeColor(daysRemaining: number): 'green' | 'yellow' | 'red' {
  if (daysRemaining >= 5) return 'green';
  if (daysRemaining >= 2) return 'yellow';
  return 'red';
}

/**
 * Get expiration text based on days remaining.
 */
export function getExpirationText(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Expires today';
  if (daysRemaining === 1) return 'Expires tomorrow';
  return `Expires in ${daysRemaining} days`;
}
