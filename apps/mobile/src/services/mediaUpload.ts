import type { ReactNativeUploadFile, UploadMediaResponse } from '@clippster/api-client';
import { getApiBaseUrl } from '@/lib/config';
import { getStoredToken } from './authStorage';

export interface UploadProgress {
  loaded: number;
  total: number;
  fraction: number;
}

export async function uploadMediaWithProgress(
  file: ReactNativeUploadFile,
  thumbnail?: ReactNativeUploadFile,
  onProgress?: (progress: UploadProgress) => void,
): Promise<UploadMediaResponse> {
  const token = await getStoredToken();
  let baseUrl = getApiBaseUrl().trim();
  if (baseUrl.endsWith('/')) baseUrl = baseUrl.slice(0, -1);
  if (!baseUrl.endsWith('/api')) baseUrl += '/api';

  const formData = new FormData();
  formData.append('file', file as unknown as Blob);
  if (thumbnail) {
    formData.append('thumbnail', thumbnail as unknown as Blob);
  }

  return new Promise((resolve) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${baseUrl}/user/posts/upload-media`);
    xhr.setRequestHeader('X-Client-Platform', 'mobile');
    if (token) {
      xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    }

    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !onProgress) return;
      onProgress({
        loaded: event.loaded,
        total: event.total,
        fraction: event.total > 0 ? event.loaded / event.total : 0,
      });
    };

    xhr.onload = () => {
      try {
        const data = JSON.parse(xhr.responseText) as UploadMediaResponse;
        resolve(data);
      } catch {
        resolve({ success: false, error: 'Invalid upload response' });
      }
    };

    xhr.onerror = () => {
      resolve({ success: false, error: 'Upload failed — check your connection' });
    };

    xhr.ontimeout = () => {
      resolve({ success: false, error: 'Upload timed out' });
    };

    xhr.timeout = 600_000;
    xhr.send(formData);
  });
}
