/**
 * Post for Me OAuth integration for Instagram, TikTok, and YouTube
 *
 * For Tauri apps, uses the Rust backend with local callback server.
 * The flow is:
 * 1. Frontend calls Tauri command to open PFM auth
 * 2. Rust starts local callback server and opens browser to backend
 * 3. Backend calls PFM API to get auth URL, redirects user
 * 4. User authorizes on platform (Instagram/TikTok/YouTube)
 * 5. PFM redirects to backend callback, backend creates account
 * 6. Backend redirects to local callback server with result
 * 7. Rust stores result and emits event to frontend
 */

import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

export type PfmPlatform = 'instagram' | 'instagram_business' | 'tiktok' | 'youtube';

/**
 * Check if running in Tauri environment
 */
export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI__' in window;
}

/**
 * Account returned from Post for Me OAuth
 */
export interface PfmAccount {
  id: number;
  platform: string;
  platform_user_id: string;
  username: string;
  display_name?: string;
  profile_image_url?: string;
  is_active: boolean;
  connected_at: string;
  pfm_account_id?: string;
  account_type?: string;
}

/**
 * Post for Me OAuth result
 */
export interface PfmAuthResult {
  success: boolean;
  account?: PfmAccount;
  error?: string;
}

/**
 * Open Post for Me OAuth flow for an organization account
 *
 * @param platform - The platform to connect
 * @param organizationId - The organization ID
 * @param apiBase - The API base URL
 * @param authToken - The user's auth token
 */
export async function openPfmAuth(
  platform: PfmPlatform,
  organizationId: string | number,
  apiBase: string,
  authToken: string
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Post for Me OAuth is only supported in the Tauri app');
  }

  await invoke('open_postforme_auth_window', {
    platform,
    apiBase,
    organizationId: String(organizationId),
    authToken,
  });
}

/**
 * Open Post for Me OAuth flow for a user-level account (no org)
 */
export async function openPfmUserAuth(
  platform: PfmPlatform,
  apiBase: string,
  authToken: string
): Promise<void> {
  if (!isTauri()) {
    throw new Error('Post for Me OAuth is only supported in the Tauri app');
  }

  await invoke('open_postforme_user_auth_window', {
    platform,
    apiBase,
    authToken,
  });
}

/**
 * Poll for Post for Me OAuth result
 */
export async function pollPfmAuthResult(): Promise<PfmAuthResult | null> {
  if (!isTauri()) {
    return null;
  }

  return await invoke<PfmAuthResult | null>('poll_postforme_auth_result');
}

/**
 * Listen for Post for Me OAuth completion event
 * Returns cleanup function
 */
export function onPfmAuthComplete(
  callback: (result: PfmAuthResult) => void
): () => void {
  if (!isTauri()) {
    return () => {};
  }

  let unlisten: UnlistenFn | null = null;

  listen<PfmAuthResult>('postforme-auth-complete', (event) => {
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
 * Start Post for Me OAuth with polling fallback (organization-level)
 *
 * @param platform - The platform to connect
 * @param organizationId - The organization ID
 * @param apiBase - The API base URL
 * @param authToken - The user's auth token
 * @param onResult - Callback when result is received
 * @param pollInterval - Polling interval in ms (default 500)
 * @param timeout - Timeout in ms (default 5 minutes)
 */
export async function startPfmOAuth(
  platform: PfmPlatform,
  organizationId: string | number,
  apiBase: string,
  authToken: string,
  onResult: (result: PfmAuthResult) => void,
  pollInterval = 500,
  timeout = 5 * 60 * 1000
): Promise<() => void> {
  let resultDelivered = false;

  const deliverResult = (result: PfmAuthResult) => {
    if (resultDelivered) return;
    resultDelivered = true;
    cancelled = true;
    cleanupListener();
    onResult(result);
  };

  const cleanupListener = onPfmAuthComplete(deliverResult);

  await openPfmAuth(platform, organizationId, apiBase, authToken);

  let cancelled = false;
  const startTime = Date.now();

  const poll = async () => {
    if (cancelled || resultDelivered) return;

    if (Date.now() - startTime > timeout) {
      deliverResult({ success: false, error: 'Authentication timed out' });
      return;
    }

    const result = await pollPfmAuthResult();
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

/**
 * Start Post for Me OAuth with polling fallback (user-level)
 */
export async function startPfmUserOAuth(
  platform: PfmPlatform,
  apiBase: string,
  authToken: string,
  onResult: (result: PfmAuthResult) => void,
  pollInterval = 500,
  timeout = 5 * 60 * 1000
): Promise<() => void> {
  let resultDelivered = false;

  const deliverResult = (result: PfmAuthResult) => {
    if (resultDelivered) return;
    resultDelivered = true;
    cancelled = true;
    cleanupListener();
    onResult(result);
  };

  const cleanupListener = onPfmAuthComplete(deliverResult);

  await openPfmUserAuth(platform, apiBase, authToken);

  let cancelled = false;
  const startTime = Date.now();

  const poll = async () => {
    if (cancelled || resultDelivered) return;

    if (Date.now() - startTime > timeout) {
      deliverResult({ success: false, error: 'Authentication timed out' });
      return;
    }

    const result = await pollPfmAuthResult();
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
