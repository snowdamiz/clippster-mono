/**
 * Organization Creator Profiles API Service
 * Handles communication with the server for organization creator profile management.
 */

import api from './api';

// ============================================
// Types
// ============================================

export interface ServerOrganizationPlatformLink {
  id: number;
  platform: 'pumpfun' | 'kick' | 'twitch' | 'youtube';
  platform_id: string;
  display_name: string | null;
  profile_image_url: string | null;
  is_primary: boolean;
  inserted_at: string;
}

export interface ServerOrganizationAssetRef {
  id: number;
  name: string;
  asset_type: string;
  url: string | null;
  thumbnail_url: string | null;
  duration: number | null;
}

export interface ServerProfileAssignment {
  id: number;
  user_id: number;
  user: {
    id: number;
    email: string;
    name: string | null;
    avatar_url: string | null;
  } | null;
  inserted_at: string;
}

export interface ServerOrganizationCreatorProfile {
  id: number;
  organization_id: number;
  organization_name?: string;
  created_by_user_id?: number | null;
  name: string;
  description?: string | null;
  profile_image_url?: string | null;
  intro_id?: number | null;
  outro_id?: number | null;
  watermark_id?: number | null;
  watermark_settings?: Record<string, unknown> | null;
  intro_outro_settings?: Record<string, unknown> | null;
  layout_overlays?: Record<string, unknown>[] | null;
  scope: 'streamer' | 'global';
  disabled: boolean;
  intro: ServerOrganizationAssetRef | null;
  outro: ServerOrganizationAssetRef | null;
  watermark: ServerOrganizationAssetRef | null;
  platform_links: ServerOrganizationPlatformLink[];
  assignments: ServerProfileAssignment[];
  assigned_count: number;
  inserted_at: string;
  updated_at: string;
}

export interface ListProfilesResponse {
  success: boolean;
  profiles: ServerOrganizationCreatorProfile[];
  error?: string;
}

export interface ProfileResponse {
  success: boolean;
  profile?: ServerOrganizationCreatorProfile;
  error?: string;
}

export interface DeleteResponse {
  success: boolean;
  error?: string;
}

export interface PlatformLinkResponse {
  success: boolean;
  link?: ServerOrganizationPlatformLink;
  error?: string;
}

export interface AssignmentResponse {
  success: boolean;
  assigned?: number;
  total?: number;
  error?: string;
}

export interface ListAssignmentsResponse {
  success: boolean;
  assignments: ServerProfileAssignment[];
  error?: string;
}

// ============================================
// User's Assigned Profiles
// ============================================

/**
 * Fetch all creator profiles assigned to the current user across all their organizations.
 * Used by branding resolution to find org-assigned streamer profiles.
 */
export async function getMyAssignedCreatorProfiles(): Promise<ListProfilesResponse> {
  try {
    const response = await api.get<ListProfilesResponse>(
      '/user/assigned-creator-profiles'
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to fetch assigned profiles:', error);
    return {
      success: false,
      profiles: [],
      error: error.response?.data?.error || error.message || 'Failed to fetch assigned profiles',
    };
  }
}

// ============================================
// Creator Profile CRUD
// ============================================

/**
 * List all creator profiles for an organization.
 */
export async function listOrganizationCreatorProfiles(
  organizationId: string | number
): Promise<ListProfilesResponse> {
  try {
    const response = await api.get<ListProfilesResponse>(
      `/organizations/${organizationId}/creator-profiles`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to list profiles:', error);
    return {
      success: false,
      profiles: [],
      error: error.response?.data?.error || error.message || 'Failed to list profiles',
    };
  }
}

/**
 * Get a single creator profile.
 */
export async function getOrganizationCreatorProfile(
  organizationId: string | number,
  profileId: number
): Promise<ProfileResponse> {
  try {
    const response = await api.get<ProfileResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to get profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get profile',
    };
  }
}

/**
 * Create a new creator profile.
 * Admin only.
 */
export async function createOrganizationCreatorProfile(
  organizationId: string | number,
  data: {
    name: string;
    description?: string;
    profile_image_url?: string | null;
    intro_id?: number | null;
    outro_id?: number | null;
    watermark_id?: number | null;
    watermark_settings?: Record<string, unknown>;
    intro_outro_settings?: Record<string, unknown>;
    layout_overlays?: Record<string, unknown>[] | null;
    scope?: 'streamer' | 'global';
  }
): Promise<ProfileResponse> {
  try {
    const response = await api.post<ProfileResponse>(
      `/organizations/${organizationId}/creator-profiles`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to create profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to create profile',
    };
  }
}

/**
 * Update a creator profile.
 * Admin only.
 */
export async function updateOrganizationCreatorProfile(
  organizationId: string | number,
  profileId: number,
  data: {
    name?: string;
    description?: string | null;
    profile_image_url?: string | null;
    intro_id?: number | null;
    outro_id?: number | null;
    watermark_id?: number | null;
    watermark_settings?: Record<string, unknown> | null;
    intro_outro_settings?: Record<string, unknown> | null;
    layout_overlays?: Record<string, unknown>[] | null;
    scope?: 'streamer' | 'global';
  }
): Promise<ProfileResponse> {
  try {
    const response = await api.put<ProfileResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to update profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update profile',
    };
  }
}

/**
 * Delete a creator profile.
 * Admin only.
 */
export async function deleteOrganizationCreatorProfile(
  organizationId: string | number,
  profileId: number
): Promise<DeleteResponse> {
  try {
    const response = await api.delete<DeleteResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to delete profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete profile',
    };
  }
}

/**
 * Toggle the disabled state of a creator profile.
 * Org admins can toggle any profile. Users can toggle their own assigned profiles.
 */
export async function toggleCreatorProfileDisabled(
  organizationId: string | number,
  profileId: number
): Promise<ProfileResponse> {
  try {
    const response = await api.post<ProfileResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/toggle-disabled`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to toggle profile disabled state:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to toggle profile',
    };
  }
}

/**
 * Upload a profile image.
 * Admin only.
 */
export async function uploadProfileImage(
  organizationId: string | number,
  profileId: number,
  file: File
): Promise<ProfileResponse & { url?: string }> {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<ProfileResponse & { url?: string }>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/image`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to upload image:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload image',
    };
  }
}

// ============================================
// Platform Links
// ============================================

/**
 * Add a platform link to a profile.
 * Admin only.
 */
export async function addPlatformLink(
  organizationId: string | number,
  profileId: number,
  data: {
    platform: 'pumpfun' | 'kick' | 'twitch' | 'youtube';
    platform_id: string;
    display_name?: string;
    profile_image_url?: string;
    is_primary?: boolean;
  }
): Promise<PlatformLinkResponse> {
  try {
    const response = await api.post<PlatformLinkResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/platform-links`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to add platform link:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to add platform link',
    };
  }
}

/**
 * Update a platform link.
 * Admin only.
 */
export async function updatePlatformLink(
  organizationId: string | number,
  profileId: number,
  linkId: number,
  data: {
    display_name?: string;
    profile_image_url?: string;
    is_primary?: boolean;
  }
): Promise<PlatformLinkResponse> {
  try {
    const response = await api.put<PlatformLinkResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/platform-links/${linkId}`,
      data
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to update platform link:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to update platform link',
    };
  }
}

/**
 * Delete a platform link.
 * Admin only.
 */
export async function deletePlatformLink(
  organizationId: string | number,
  profileId: number,
  linkId: number
): Promise<DeleteResponse> {
  try {
    const response = await api.delete<DeleteResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/platform-links/${linkId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to delete platform link:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to delete platform link',
    };
  }
}

// ============================================
// Assignments
// ============================================

/**
 * List all assignments for a profile.
 * Admin only.
 */
export async function listProfileAssignments(
  organizationId: string | number,
  profileId: number
): Promise<ListAssignmentsResponse> {
  try {
    const response = await api.get<ListAssignmentsResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/assignments`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to list assignments:', error);
    return {
      success: false,
      assignments: [],
      error: error.response?.data?.error || error.message || 'Failed to list assignments',
    };
  }
}

/**
 * Assign a profile to members.
 * Admin only.
 */
export async function assignProfile(
  organizationId: string | number,
  profileId: number,
  userIds: number[]
): Promise<AssignmentResponse> {
  try {
    const response = await api.post<AssignmentResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/assignments`,
      { user_ids: userIds }
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to assign profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to assign profile',
    };
  }
}

/**
 * Unassign a profile from a member.
 * Admin only.
 */
export async function unassignProfile(
  organizationId: string | number,
  profileId: number,
  userId: number
): Promise<DeleteResponse> {
  try {
    const response = await api.delete<DeleteResponse>(
      `/organizations/${organizationId}/creator-profiles/${profileId}/assignments/${userId}`
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to unassign profile:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to unassign profile',
    };
  }
}

/**
 * Get all profiles assigned to the current user across all organizations.
 */
export async function getUserAssignedCreatorProfiles(): Promise<ListProfilesResponse> {
  try {
    const response = await api.get<ListProfilesResponse>('/user/assigned-creator-profiles');
    return response.data;
  } catch (error: any) {
    console.error('[OrgProfilesApi] Failed to get assigned profiles:', error);
    return {
      success: false,
      profiles: [],
      error: error.response?.data?.error || error.message || 'Failed to get assigned profiles',
    };
  }
}
