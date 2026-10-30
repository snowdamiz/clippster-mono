import api from './api';

interface PresignResponse {
  success: boolean;
  upload_url?: string;
  key?: string;
  error?: string;
}

/**
 * Upload a file directly to R2 using a presigned URL
 */
export async function uploadToPresignedUrl(
  presignedUrl: string,
  file: File,
  onProgress?: (progress: number) => void,
  contentType: string = file.type
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
    xhr.setRequestHeader('Content-Type', contentType);
    xhr.send(file);
  });
}

/**
 * Adds `file` to an upload form. When the API offers a presigned upload at `presignPath`, the
 * file goes straight to R2 and the form carries its key, so large files skip the 100 MB request
 * cap in front of the API. An API without that endpoint (404) gets the file itself, as before.
 */
export async function attachUpload(
  formData: FormData,
  file: File,
  presignPath: string,
  onProgress?: (progress: number) => void
): Promise<void> {
  const contentType = file.type || 'video/mp4';
  let presign: PresignResponse;
  try {
    presign = (
      await api.post<PresignResponse>(presignPath, {
        filename: file.name,
        content_type: contentType,
        file_size: file.size,
      })
    ).data;
  } catch (error: any) {
    if (error.response?.status !== 404) throw error;
    formData.append('file', file);
    return;
  }

  if (!presign.success || !presign.upload_url || !presign.key) {
    throw new Error(presign.error || 'Could not start the upload');
  }
  await uploadToPresignedUrl(presign.upload_url, file, onProgress, contentType);
  formData.append('uploaded_key', presign.key);
  formData.append('filename', file.name);
  formData.append('content_type', contentType);
}
