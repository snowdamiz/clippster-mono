/**
 * Instagram Business Login OAuth integration
 *
 * For Tauri apps, uses the Rust backend with local callback server.
 * The flow is:
 * 1. Frontend calls Tauri command to open Instagram auth
 * 2. Rust starts local callback server and opens browser to backend
 * 3. Backend redirects to Instagram OAuth
 * 4. After auth, backend redirects to local callback server
 * 5. Rust stores result and emits event to frontend
 * 6. Frontend polls for result or listens for event
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Instagram account returned from OAuth
 */
export interface InstagramAccount {
  id: number;
  platform: string;
  platform_user_id: string;
  username: string;
  display_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  connected_at: string;
}

/**
 * Instagram OAuth result
 */
export interface InstagramAuthResult {
  success: boolean;
  account?: InstagramAccount;
  error?: string;
}

/**
 * Open Instagram OAuth flow
 *
 * @param organizationId - The organization ID to associate with the connection
 * @param apiBase - The API base URL
 * @param authToken - The user's auth token
 */
export async function openInstagramAuth(
  organizationId: string | number,
  apiBase: string,
  authToken: string
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Instagram OAuth is only supported in the Tauri app');
  }

  await invoke('open_instagram_auth_window', {
    apiBase,
    organizationId: String(organizationId),
    authToken,
  });
}

/**
 * Poll for Instagram OAuth result
 */
export async function pollInstagramAuthResult(): Promise<InstagramAuthResult | null> {
  if (!isTauri()) {
    return null;
  }

  return await invoke<InstagramAuthResult | null>('poll_instagram_auth_result');
}

/**
 * Listen for Instagram OAuth completion event
 * Returns cleanup function
 */
export function onInstagramAuthComplete(
  callback: (result: InstagramAuthResult) => void
): () => void {
  if (!isTauri()) {
    // Return no-op cleanup for non-Tauri
    return () => {};
  }

  let unlisten: UnlistenFn | null = null;

  // Set up event listener
  listen<InstagramAuthResult>('instagram-auth-complete', (event) => {
    callback(event.payload);
  }).then((fn) => {
    unlisten = fn;
  });

  // Return cleanup function
  return () => {
    if (unlisten) {
      unlisten();
    }
  };
}

/**
 * Start Instagram OAuth with polling fallback
 *
 * @param organizationId - The organization ID
 * @param apiBase - The API base URL
 * @param authToken - The user's auth token
 * @param onResult - Callback when result is received
 * @param pollInterval - Polling interval in ms (default 500)
 * @param timeout - Timeout in ms (default 5 minutes)
 */
export async function startInstagramOAuth(
  organizationId: string | number,
  apiBase: string,
  authToken: string,
  onResult: (result: InstagramAuthResult) => void,
  pollInterval = 500,
  timeout = 5 * 60 * 1000
): Promise<() => void> {
  // Track if result has been delivered to prevent duplicate callbacks
  let resultDelivered = false;

  const deliverResult = (result: InstagramAuthResult) => {
    if (resultDelivered) return;
    resultDelivered = true;
    cancelled = true;
    cleanupListener();
    onResult(result);
  };

  // Set up event listener
  const cleanupListener = onInstagramAuthComplete(deliverResult);

  // Open the auth window
  await openInstagramAuth(organizationId, apiBase, authToken);

  // Start polling as fallback
  let cancelled = false;
  const startTime = Date.now();

  const poll = async () => {
    if (cancelled || resultDelivered) return;

    if (Date.now() - startTime > timeout) {
      deliverResult({ success: false, error: 'Authentication timed out' });
      return;
    }

    const result = await pollInstagramAuthResult();
    if (result) {
      deliverResult(result);
      return;
    }

    // Continue polling
    setTimeout(poll, pollInterval);
  };

  // Start polling after a short delay
  setTimeout(poll, pollInterval);

  // Return cleanup function
  return () => {
    cancelled = true;
    cleanupListener();
  };
}
