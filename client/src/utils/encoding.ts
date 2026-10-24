/**
 * Encode a Unicode string to base64
 *
 * The native btoa() function only works with Latin1 characters.
 * This function properly handles Unicode strings (like file paths with emojis)
 * by first encoding to UTF-8 bytes.
 */
export function utf8ToBase64(str: string): string {
  return bytesToBase64(new TextEncoder().encode(str));
}

/** Base64 for binary data (media files read from disk). */
export function bytesToBase64(bytes: Uint8Array): string {
  const chunk = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

/**
 * Encode a Unicode string to URL-safe base64 (RFC 4648, no padding).
 */
export function utf8ToBase64Url(str: string): string {
  return utf8ToBase64(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

/**
 * Decode a base64 string to Unicode
 *
 * This is the inverse of utf8ToBase64()
 */
export function base64ToUtf8(base64: string): string {
  const normalized = base64.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
