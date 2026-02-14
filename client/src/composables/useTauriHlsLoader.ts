import { invoke } from '@tauri-apps/api/core';
import type { Loader, LoaderContext, LoaderResponse, LoaderConfiguration, LoaderCallbacks, LoaderStats } from 'hls.js';

/**
 * Custom HLS.js loader that uses Tauri commands instead of HTTP fetch
 * This eliminates CORS/PNA issues by reading files directly through Tauri
 */
export class TauriHlsLoader implements Loader<LoaderContext> {
  public context: LoaderContext | null = null;
  private callbacks: LoaderCallbacks<LoaderContext> | null = null;
  private aborted = false;
  public stats: LoaderStats = {
    aborted: false,
    loaded: 0,
    retry: 0,
    total: 0,
    chunkCount: 0,
    bwEstimate: 0,
    loading: { start: 0, first: 0, end: 0 },
    parsing: { start: 0, end: 0 },
    buffering: { start: 0, first: 0, end: 0 },
  };

  constructor(_config: any) {
    // HLS.js passes HlsConfig, but we don't need it for Tauri-based loading
  }

  destroy(): void {
    this.abort();
    this.context = null;
    this.callbacks = null;
  }

  abort(): void {
    this.aborted = true;
  }

  load(
    context: LoaderContext,
    _config: LoaderConfiguration,
    callbacks: LoaderCallbacks<LoaderContext>
  ): void {
    this.context = context;
    this.callbacks = callbacks;
    this.aborted = false;

    this.loadInternal(context, callbacks);
  }

  private async loadInternal(
    context: LoaderContext,
    callbacks: LoaderCallbacks<LoaderContext>
  ): Promise<void> {
    const { url } = context;

    try {
      // Parse the URL to extract encoded directory and filename
      // Expected format: asset://hls/{encodedDir}/{filename}
      const urlObj = new URL(url);
      
      if (urlObj.protocol !== 'asset:') {
        // Fallback to regular fetch for non-asset URLs (e.g., Kick proxy)
        return this.loadViaFetch(context, callbacks);
      }

      const pathParts = urlObj.pathname.split('/').filter(Boolean);
      
      if (pathParts.length < 2 || pathParts[0] !== 'hls') {
        throw new Error(`Invalid Asset HLS URL format: ${url}`);
      }

      const encodedDir = pathParts[1];
      const filename = pathParts.slice(2).join('/');

      // Determine if this is a playlist or segment
      const isPlaylist = filename.endsWith('.m3u8');

      let data: string | Uint8Array;

      if (isPlaylist) {
        // Read playlist as text
        const content = await invoke<string>('read_hls_playlist', {
          encodedDir,
          filename,
        });

        data = content;
        this.stats.loaded = content.length;
        this.stats.total = content.length;
      } else {
        // Read segment as binary
        const content = await invoke<number[]>('read_hls_segment', {
          encodedDir,
          filename,
        });

        data = new Uint8Array(content);
        this.stats.loaded = data.byteLength;
        this.stats.total = data.byteLength;
      }

      if (this.aborted) return;

      const response: LoaderResponse = {
        url,
        data,
      };

      callbacks.onSuccess(response, this.stats, context, null as any);
    } catch (error) {
      if (this.aborted) return;

      callbacks.onError(
        {
          code: 0,
          text: error instanceof Error ? error.message : String(error),
        },
        context,
        null,
        this.stats
      );
    }
  }

  /**
   * Fallback to regular fetch for non-asset URLs (e.g., Kick HLS proxy)
   */
  private async loadViaFetch(
    context: LoaderContext,
    callbacks: LoaderCallbacks<LoaderContext>
  ): Promise<void> {
    const { url, responseType } = context;

    try {
      const response = await fetch(url, {
        mode: 'cors',
        cache: 'no-store',
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      if (this.aborted) return;

      let data: string | ArrayBuffer;

      if (responseType === 'arraybuffer') {
        data = await response.arrayBuffer();
      } else {
        data = await response.text();
      }

      if (this.aborted) return;

      this.stats.loaded = data instanceof ArrayBuffer ? data.byteLength : data.length;
      this.stats.total = data instanceof ArrayBuffer ? data.byteLength : data.length;

      const loaderResponse: LoaderResponse = {
        url,
        data,
      };

      callbacks.onSuccess(loaderResponse, this.stats, context, null as any);
    } catch (error) {
      if (this.aborted) return;

      callbacks.onError(
        {
          code: 0,
          text: error instanceof Error ? error.message : String(error),
        },
        context,
        null,
        this.stats
      );
    }
  }

  getResponseHeader(): string | null {
    return null;
  }
}

/**
 * Helper function to convert local HLS directory path to Asset URL
 */
export function getTauriHlsUrl(outputDir: string, filename = 'playlist.m3u8'): string {
  const encodedDir = btoa(outputDir);
  return `asset://hls/${encodedDir}/${filename}`;
}

/**
 * Helper function to check if playlist exists via Tauri command
 */
export async function checkPlaylistExists(outputDir: string, filename = 'playlist.m3u8'): Promise<boolean> {
  const encodedDir = btoa(outputDir);
  try {
    return await invoke<boolean>('check_hls_playlist_exists', {
      encodedDir,
      filename,
    });
  } catch {
    return false;
  }
}
