import { ref, watchEffect } from 'vue';
import { invoke } from '@tauri-apps/api/core';

const isTauri = typeof window !== 'undefined' && '__TAURI__' in window;

// Module-level cache shared across all component instances
const avatarCache = new Map<string, string>();
const pendingFetches = new Map<string, Promise<string>>();

async function fetchAvatarUrl(url: string): Promise<string> {
  if (avatarCache.has(url)) {
    return avatarCache.get(url)!;
  }

  // Deduplicate concurrent requests for the same URL
  if (pendingFetches.has(url)) {
    return pendingFetches.get(url)!;
  }

  const promise = invoke<string>('fetch_avatar_image', { url })
    .then((dataUrl) => {
      avatarCache.set(url, dataUrl);
      pendingFetches.delete(url);
      return dataUrl;
    })
    .catch((err) => {
      pendingFetches.delete(url);
      throw err;
    });

  pendingFetches.set(url, promise);
  return promise;
}

/**
 * Resolves an external avatar URL through Tauri's native HTTP client (reqwest),
 * bypassing WKWebView rate limiting from Google's CDN. The result is cached in
 * memory for the lifetime of the app session.
 */
export function useAvatarProxy(getUrl: () => string | null | undefined) {
  const resolvedUrl = ref<string | null>(null);
  const failed = ref(false);

  watchEffect(async () => {
    const url = getUrl();

    if (!url) {
      resolvedUrl.value = null;
      return;
    }

    // In browser/non-Tauri dev, use the URL directly
    if (!isTauri) {
      resolvedUrl.value = url;
      return;
    }

    // Check module cache synchronously first to avoid flicker
    if (avatarCache.has(url)) {
      resolvedUrl.value = avatarCache.get(url)!;
      failed.value = false;
      return;
    }

    try {
      const dataUrl = await fetchAvatarUrl(url);
      resolvedUrl.value = dataUrl;
      failed.value = false;
    } catch (err) {
      console.warn('[useAvatarProxy] Failed to fetch avatar:', err);
      resolvedUrl.value = null;
      failed.value = true;
    }
  });

  return { resolvedUrl, failed };
}
