/**
 * X (Twitter) OAuth integration for organization accounts
 *
 * For Tauri apps, uses the Rust backend with local callback server.
 * The flow is:
 * 1. Frontend calls Tauri command to open Twitter auth
 * 2. Rust starts local callback server and opens browser to backend
 * 3. Backend redirects to X OAuth
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
 * Twitter account returned from OAuth
 */
export interface TwitterAccount {
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
 * Twitter OAuth result
 */
export interface TwitterAuthResult {
  success: boolean;
  account?: TwitterAccount;
  error?: string;
}

/**
 * Open Twitter OAuth flow
 *
 * @param organizationId - The organization ID to associate with the connection
 * @param apiBase - The API base URL
 * @param authToken - The user's auth token
 */
export async function openTwitterAuth(
  organizationId: string | number,
  apiBase: string,
  authToken: string
): Promise<void> {
  if (!isTauri()) {
    throw new Error('X OAuth is only supported in the Tauri app');
  }

  await invoke('open_twitter_auth_window', {
    apiBase,
    organizationId: String(organizationId),
    authToken,
  });
}

/**
 * Poll for Twitter OAuth result
 */
export async function pollTwitterAuthResult(): Promise<TwitterAuthResult | null> {
  if (!isTauri()) {
    return null;
  }

  return await invoke<TwitterAuthResult | null>('poll_twitter_auth_result');
}

/**
 * Listen for Twitter OAuth completion event
 * Returns cleanup function
 */
export function onTwitterAuthComplete(
  callback: (result: TwitterAuthResult) => void
): () => void {
  if (!isTauri()) {
    return () => {};
  }

  let unlisten: UnlistenFn | null = null;

  listen<TwitterAuthResult>('twitter-auth-complete', (event) => {
    callback(event.payload);
  }).then((fn) => {
    unlisten = fn;
  });

  return () => {
    if (unlisten) {
      unlisten();
    }
  };
}

/**
 * Start Twitter OAuth with polling fallback
 *
 * @param organizationId - The organization ID
 * @param apiBase - The API base URL
 * @param authToken - The user's auth token
 * @param onResult - Callback when result is received
 * @param pollInterval - Polling interval in ms (default 500)
 * @param timeout - Timeout in ms (default 5 minutes)
 */
export async function startTwitterOAuth(
  organizationId: string | number,
  apiBase: string,
  authToken: string,
  onResult: (result: TwitterAuthResult) => void,
  pollInterval = 500,
  timeout = 5 * 60 * 1000
): Promise<() => void> {
  let resultDelivered = false;

  const deliverResult = (result: TwitterAuthResult) => {
    if (resultDelivered) return;
    resultDelivered = true;
    cancelled = true;
    cleanupListener();
    onResult(result);
  };

  // Set up event listener
  const cleanupListener = onTwitterAuthComplete(deliverResult);

  // Open the auth window
  await openTwitterAuth(organizationId, apiBase, authToken);

  // Start polling as fallback
  let cancelled = false;
  const startTime = Date.now();

  const poll = async () => {
    if (cancelled || resultDelivered) return;

    if (Date.now() - startTime > timeout) {
      deliverResult({ success: false, error: 'Authentication timed out' });
      return;
    }

    const result = await pollTwitterAuthResult();
    if (result) {
      deliverResult(result);
      return;
    }

    setTimeout(poll, pollInterval);
  };

  setTimeout(poll, pollInterval);

  return () => {
    cancelled = true;
    cleanupListener();
  };
}
