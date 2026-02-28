/**
 * Tauri environment detection utility.
 * Legacy Instagram OAuth has been removed — all OAuth flows use PostForMe.
 */

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}
