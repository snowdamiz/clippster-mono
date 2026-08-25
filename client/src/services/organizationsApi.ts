import api from './api';

export interface CheckOrgNameResponse {
  success: boolean;
  available?: boolean;
  error?: string;
}

/**
 * Check if an organization name is available (case-insensitive).
 * Optionally pass excludeOrgId to exclude a specific org (for updates).
 */
export async function checkOrgNameAvailable(
  name: string,
  excludeOrgId?: number
): Promise<CheckOrgNameResponse> {
  try {
    const params: Record<string, string> = { name };
    if (excludeOrgId) {
      params.exclude_org_id = String(excludeOrgId);
    }
    const response = await api.get<CheckOrgNameResponse>('/organizations/check-name', { params });
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to check org name:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to check name availability',
    };
  }
}

export interface UploadLogoResponse {
  success: boolean;
  logo_url?: string;
  error?: string;
}

export interface OrganizationInvitation {
  id: number;
  organization_id: number;
  organization_name: string;
  organization_logo?: string;
  role: string;
  inviter_name?: string;
  expires_at: string;
  inserted_at: string;
}

export interface InviteUserResponse {
  success: boolean;
  invitation?: any;
  message?: string;
  error?: string;
}

export interface ListInvitationsResponse {
  success: boolean;
  invitations: OrganizationInvitation[];
  error?: string;
}

/**
 * Upload a logo image for an organization.
 * Admin only.
 * Max file size: 5MB
 * Allowed types: JPEG, PNG, GIF, WebP
 */
export async function uploadOrganizationLogo(
  organizationId: string | number,
  file: File
): Promise<UploadLogoResponse> {
  // Validate file size (5MB max)
  const MAX_SIZE = 5 * 1024 * 1024; // 5MB in bytes
  if (file.size > MAX_SIZE) {
    return {
      success: false,
      error: `File size exceeds 5MB limit. Your file is ${(file.size / (1024 * 1024)).toFixed(1)}MB`,
    };
  }

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      success: false,
      error: 'Invalid file type. Allowed: JPEG, PNG, GIF, WebP',
    };
  }

  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await api.post<UploadLogoResponse>(
      `/organizations/${organizationId}/logo`,
      formData,
      {
        headers: {
          'Content-Type': undefined,
        },
      }
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to upload logo:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to upload logo',
    };
  }
}

/**
 * Invite a user to join an organization by user_id (for Clipper Directory).
 */
export async function inviteUserToOrganization(
  organizationId: string | number,
  userId: string | number,
  role: string = 'member'
): Promise<InviteUserResponse> {
  try {
    const response = await api.post<InviteUserResponse>(
      `/organizations/${organizationId}/invite-user`,
      { user_id: userId, role }
    );
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to invite user:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to send invitation',
    };
  }
}

/**
 * List pending invitations for the current user.
 */
export async function listMyInvitations(): Promise<ListInvitationsResponse> {
  try {
    const response = await api.get<ListInvitationsResponse>('/me/invitations');
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to list invitations:', error);
    return {
      success: false,
      invitations: [],
      error: error.response?.data?.error || error.message || 'Failed to load invitations',
    };
  }
}

/**
 * Accept an organization invitation by token (for email link acceptance).
 */
export async function acceptInvitation(token: string): Promise<{ success: boolean; message?: string; organization_id?: number; error?: string }> {
  try {
    const response = await api.post(`/invitations/${token}/accept`);
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to accept invitation:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to accept invitation',
    };
  }
}

/**
 * Accept an organization invitation by ID (for in-app acceptance).
 */
export async function acceptInvitationById(invitationId: number): Promise<{ success: boolean; message?: string; organization_id?: number; error?: string }> {
  try {
    const response = await api.post(`/invitations/${invitationId}/accept-by-id`);
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to accept invitation:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to accept invitation',
    };
  }
}

export interface DeclineNotification {
  organization_id: number;
  organization_name: string;
  inviter_user_id: number;
  declined_by_name: string;
}

/**
 * Decline an organization invitation.
 * Returns notification data so the app can notify the org owner.
 */
export async function declineInvitation(invitationId: number): Promise<{ success: boolean; message?: string; notification?: DeclineNotification; error?: string }> {
  try {
    const response = await api.delete(`/invitations/${invitationId}`);
    return response.data;
  } catch (error: any) {
    console.error('[OrganizationsApi] Failed to decline invitation:', error);
    return {
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to decline invitation',
    };
  }
}
