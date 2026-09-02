import type { ListVodsResponse, MediaProbeResponse, ResolveUrlResponse } from '@clippster/shared-types';
import type { ApiClient } from './createApiClient';

export function createMediaApi(client: ApiClient) {
  return {
    resolveUrl(url: string, options?: { quality?: string; platform?: string }) {
      return client.post<ResolveUrlResponse>('/media/resolve-url', {
        url,
        quality: options?.quality ?? 'best',
        platform: options?.platform,
      });
    },

    probe(url: string, platform?: string) {
      return client.post<MediaProbeResponse>('/media/probe', { url, platform });
    },

    listVods(platform: string, channel: string, options?: { limit?: number; offset?: number }) {
      const params = new URLSearchParams({
        platform,
        channel,
        limit: String(options?.limit ?? 20),
        offset: String(options?.offset ?? 0),
      });
      return client.get<ListVodsResponse>(`/media/vods?${params.toString()}`);
    },
  };
}

export type MediaApi = ReturnType<typeof createMediaApi>;
