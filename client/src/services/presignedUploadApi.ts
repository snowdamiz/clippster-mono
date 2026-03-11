const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

function getAuthToken(): string {
  return localStorage.getItem('auth_token') || '';
}

export interface PresignedUploadResponse {
  success: boolean;
  upload_url?: string;
  media_url?: string;
  thumbnail_url?: string | null;
  error?: string;
}

/**
 * Get a presigned URL for direct R2 upload (organization context)
 */
export async function getPresignedUploadUrl(
  organizationId: number,
  filename: string,
  contentType: string = 'video/mp4'
): Promise<PresignedUploadResponse> {
  const token = await getAuthToken();
  
  const response = await fetch(
    `${API_BASE_URL}/api/organizations/${organizationId}/posts/presigned-upload`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        filename,
        content_type: contentType,
      }),
    }
  );

  return response.json();
}

/**
 * Upload a file directly to R2 using a presigned URL
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentComplete = (e.loaded / e.total) * 100;
          onProgress(percentComplete);
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Upload failed'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload aborted'));
    });

    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);
    xhr.send(file);
  });
}
