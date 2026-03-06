import api from './api';

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
 * Accept an organization invitation.
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
