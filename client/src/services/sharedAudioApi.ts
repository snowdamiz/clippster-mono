/**
 * Shared Audio API Service
 * Handles communication with the server for organization shared audio files.
 */

import api from './api';

export interface SharedAudioUser {
  id: number;
  email: string;
  name: string | null;
  avatar_url: string | null;
}

export interface SharedAudioRecipient {
  user_id: number;
  user: SharedAudioUser | null;
  viewed_at: string | null;
  downloaded_at: string | null;
}

export interface SharedAudioStats {
  total: number;
  viewed: number;
  downloaded: number;
}

export interface SharedAudio {
  id: number;
  organization_id: number;
  organization_name?: string;
  name: string;
  description: string | null;
  url?: string;
  mime_type: string | null;
  duration: number | null;
  file_size: number | null;
  share_with_all: boolean;
  expires_at: string;
  days_until_expiration: number;
  inserted_at: string;
  uploaded_by: SharedAudioUser | null;
  stats?: SharedAudioStats;
  recipients?: SharedAudioRecipient[];
  viewed_at?: string | null;
  downloaded_at?: string | null;
}

export interface ListSharedAudioResponse {
  success: boolean;
  audio: SharedAudio[];
  error?: string;
}

export interface SharedAudioResponse {
  success: boolean;
  audio?: SharedAudio;
  error?: string;
}

export interface ActionResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export async function createSharedAudio(
  organizationId: string | number,
  file: File,
  options: {
    name?: string;
    description?: string;
    duration?: number;
    shareWithAll?: boolean;
    recipientUserIds?: number[];
  }
): Promise<SharedAudioResponse> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    if (options.name) formData.append('name', options.name);
    if (options.description) formData.append('description', options.description);
    if (options.duration !== undefined) formData.append('duration', String(options.duration));
    if (options.shareWithAll !== undefined) {
      formData.append('share_with_all', String(options.shareWithAll));
    }
    if (options.recipientUserIds && options.recipientUserIds.length > 0) {
      formData.append('recipient_user_ids', JSON.stringify(options.recipientUserIds));
    }

    const response = await api.post<SharedAudioResponse>(
      `/organizations/${organizationId}/shared-audio`,
      formData,
      {
        headers: { 'Content-Type': undefined },
        timeout: 600000,
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedAudioApi] Failed to create shared audio:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to share audio',
    };
  }
}

export async function listOrganizationSharedAudio(
  organizationId: string | number
): Promise<ListSharedAudioResponse> {
  try {
    const response = await api.get<ListSharedAudioResponse>(
      `/organizations/${organizationId}/shared-audio`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedAudioApi] Failed to list shared audio:', error);
    return {
      success: false,
      audio: [],
      error: error.response?.data?.error || error.message || 'Failed to list shared audio',
    };
  }
}

export async function getUserSharedAudio(): Promise<ListSharedAudioResponse> {
  try {
    const response = await api.get<ListSharedAudioResponse>('/user/shared-audio');
    return response.data;
  } catch (error: any) {
    console.error('[SharedAudioApi] Failed to get user shared audio:', error);
    return {
      success: false,
      audio: [],
      error: error.response?.data?.error || error.message || 'Failed to get shared audio',
    };
  }
}

export async function deleteSharedAudio(
  organizationId: string | number,
  audioId: string | number
): Promise<ActionResponse> {
  try {
    const response = await api.delete<ActionResponse>(
      `/organizations/${organizationId}/shared-audio/${audioId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[SharedAudioApi] Failed to delete shared audio:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete shared audio',
    };
  }
}

export async function markSharedAudioViewed(audioId: string | number): Promise<ActionResponse> {
  try {
    const response = await api.post<ActionResponse>(`/shared-audio/${audioId}/mark-viewed`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark as viewed',
    };
  }
}

export async function markSharedAudioDownloaded(audioId: string | number): Promise<ActionResponse> {
  try {
    const response = await api.post<ActionResponse>(`/shared-audio/${audioId}/mark-downloaded`);
    return response.data;
  } catch (error: any) {
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark as downloaded',
    };
  }
}

export function getExpirationBadgeColor(daysRemaining: number): 'green' | 'yellow' | 'red' {
  if (daysRemaining >= 20) return 'green';
  if (daysRemaining >= 7) return 'yellow';
  return 'red';
}

export function getExpirationText(daysRemaining: number): string {
  if (daysRemaining <= 0) return 'Expires today';
  if (daysRemaining === 1) return 'Expires tomorrow';
  return `Expires in ${daysRemaining} days`;
}

export function getAudioExtension(mimeType: string | null | undefined, name: string): string {
  if (mimeType?.includes('mpeg') || mimeType?.includes('mp3')) return 'mp3';
  if (mimeType?.includes('wav')) return 'wav';
  if (mimeType?.includes('ogg')) return 'ogg';
  if (mimeType?.includes('aac') || mimeType?.includes('m4a')) return 'm4a';
  const match = name.match(/\.([^.]+)$/);
  return match ? match[1] : 'mp3';
}
