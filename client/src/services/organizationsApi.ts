import api from './api';

export interface UploadLogoResponse {
  success: boolean;
  logo_url?: string;
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
          'Content-Type': 'multipart/form-data',
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
