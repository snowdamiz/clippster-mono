import { tokendApi } from './api';
import type { TokendModeInfo } from './tokendTypes';
import { extractTokendChannel } from './tokendUrl';

export type {
  TokendCapabilities,
  TokendConnectStrategy,
  TokendModeInfo,
} from './tokendTypes';

export {
  getTokendCapabilities,
  getTokendConnectStrategy,
  getTokendConnectUnavailableMessage,
  TOKEND_UNAVAILABLE_MESSAGES,
} from './tokendTypes';

export { extractTokendChannel, isTokendUrl, parseTokendMediaRef } from './tokendUrl';

export async function fetchTokendMode(): Promise<TokendModeInfo> {
  return tokendApi.getMode();
}

export async function fetchTokendCatalog(slug: string) {
  return tokendApi.getCatalog(slug);
}

export async function getTokendVods(
  channelOrUrl: string,
  limit = 20,
  tab: 'streams' | 'videos' = 'streams',
) {
  const slug = extractTokendChannel(channelOrUrl) || channelOrUrl.trim().replace(/^@/, '');
  if (!slug) return [];
  const catalog = await fetchTokendCatalog(slug);
  const items = tab === 'videos' ? catalog.videos : catalog.streams;
  return items.slice(0, limit).map((item) => ({
    id: item.id,
    title: item.title,
    duration_seconds: item.duration ?? null,
    thumbnail_url: item.thumbnailUrl ?? null,
    url: item.url,
    upload_date: item.publishedAt ?? null,
    kind: item.kind,
  }));
}
