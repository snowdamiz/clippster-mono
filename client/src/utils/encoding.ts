/**
 * Encode a Unicode string to base64
 *
 * The native btoa() function only works with Latin1 characters.
 * This function properly handles Unicode strings (like file paths with emojis)
 * by first encoding to UTF-8 bytes.
 */
export function utf8ToBase64(str: string): string {
  const encoder = new TextEncoder();
  const bytes = encoder.encode(str);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Decode a base64 string to Unicode
 *
 * This is the inverse of utf8ToBase64()
 */
export function base64ToUtf8(base64: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const decoder = new TextDecoder();
  return decoder.decode(bytes);
}
