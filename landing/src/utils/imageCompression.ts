import imageCompression from 'browser-image-compression'

/**
 * Compresses an image file to reduce size while maintaining quality.
 * @param file - The image file to compress
 * @param maxSizeMB - Maximum size in MB (default: 15)
 * @returns Compressed image file
 */
export async function compressImage(file: File, maxSizeMB: number = 15): Promise<File> {
  const options = {
    maxSizeMB,
    maxWidthOrHeight: 4096,
    useWebWorker: true,
    fileType: 'image/jpeg',
    initialQuality: 0.85,
  }

  try {
    const compressedFile = await imageCompression(file, options)
    return compressedFile
  } catch (error) {
    console.error('Error compressing image:', error)
    // If compression fails, return original file if it's under the size limit
    if (file.size <= maxSizeMB * 1024 * 1024) {
      return file
    }
    throw new Error('Image is too large and compression failed')
  }
}

/**
 * Compresses multiple image files.
 * @param files - Array of image files to compress
 * @param maxSizeMB - Maximum size in MB per file
 * @returns Array of compressed image files
 */
export async function compressImages(files: File[], maxSizeMB: number = 15): Promise<File[]> {
  return Promise.all(files.map(file => compressImage(file, maxSizeMB)))
}

/**
 * Validates if a file is an image and under the size limit.
 * @param file - File to validate
 * @param maxSizeMB - Maximum size in MB
 * @returns true if valid, false otherwise
 */
export function validateImageFile(file: File, maxSizeMB: number = 15): boolean {
  const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp']
  const maxBytes = maxSizeMB * 1024 * 1024

  if (!validTypes.includes(file.type)) {
    return false
  }

  if (file.size > maxBytes) {
    return false
  }

  return true
}

/**
 * Formats file size for display.
 * @param bytes - File size in bytes
 * @returns Formatted string (e.g., "2.5 MB")
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'

  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i]
}
