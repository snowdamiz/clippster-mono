/**
 * Tokend platform client (Stream VODs + Live Clip + connect helpers).
 *
 * Public product host: https://tokend.tv (creator pages at /:slug).
 * Local Tokend web: http://localhost:4100 — API: http://localhost:4101.
 * Seed creators (seed-nova, …) exist only after local Tokend seed-data; not on production.
 *
 * Catalog/status/connect go through Clippster Phoenix. Never put OAuth secrets in the desktop client.
 */

export interface TokendCatalogItem {
  id: string;
  title: string;
  duration?: number;
  thumbnailUrl?: string | null;
  url: string;
  publishedAt?: string | null;
  kind: 'stream' | 'video';
}

export interface TokendCatalog {
  mode: string;
  slug: string;
  displayName: string;
  avatarUrl?: string | null;
  streams: TokendCatalogItem[];
  videos: TokendCatalogItem[];
  note?: string;
}

export interface TokendLiveStatus {
  mode?: string;
  isLive: boolean;
  channelId?: string;
  displayName?: string;
  profileImageUrl?: string | null;
  streamTitle?: string | null;
  viewerCount?: number;
  thumbnailUrl?: string | null;
  startedAt?: string | null;
  error?: string;
  note?: string;
}

export interface TokendVod {
  videoId: string;
  title?: string;
  duration?: number;
  viewCount?: number;
  thumbnailUrl?: string;
  uploadDate?: string;
  url: string;
  isLive: boolean;
  kind: 'stream' | 'video';
}

export interface TokendModeInfo {
  mode: 'mock' | 'local' | 'live';
  configured: boolean;
  message?: string;
}

/** Reserved path segments on Tokend web (not creator slugs). */
const RESERVED_SLUGS = new Set([
  'live',
  'launch',
  'discover',
  'markets',
  'portfolio',
  'dashboard',
  'settings',
  'stream',
  'profile',
  'token',
  'admin',
  'api',
  'uploads',
  'feed',
  'communities',
  'circle',
  'messages',
  'notifications',
  'bookmarks',
  'obs',
  'u',
  'auth',
  'egress',
  'predictions',
  'callouts',
  'pulse',
]);

const LOCAL_WEB_PORTS = new Set(['4100']);

function isTokendHostname(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'tokend.tv' || host.endsWith('.tokend.tv')) return true;
  if (host === 'localhost' || host === '127.0.0.1') return true;
  return false;
}

function isLocalTokendWeb(url: URL): boolean {
  const host = url.hostname.toLowerCase();
  if (host !== 'localhost' && host !== '127.0.0.1') return false;
  return LOCAL_WEB_PORTS.has(url.port || '80');
}

/** True when input is a tokend.tv or local Tokend web URL. */
export function isTokendUrl(input: string): boolean {
  if (!input || typeof input !== 'string') return false;
  const trimmed = input.trim();

  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (!isTokendHostname(url.hostname)) return false;
    if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
      return isLocalTokendWeb(url);
    }
    return true;
  } catch {
    return /(?:^|\.)tokend\.tv(?:\/|$)/i.test(trimmed);
  }
}

/**
 * Extract Tokend creator slug from URL or @handle.
 * Examples:
 * - https://tokend.tv/seed-nova
 * - http://localhost:4100/seed-nova/vods
 * - https://tokend.tv/stream/seed-nova
 * - @seed-nova
 */
export function extractTokendChannel(input: string): string | null {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();

  const atMatch = trimmed.match(/^@([a-zA-Z0-9_-]{2,})$/);
  if (atMatch) return atMatch[1].toLowerCase();

  if (/^seed-[a-z0-9_-]+$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    if (!isTokendHostname(url.hostname)) return null;
    if (
      (url.hostname === 'localhost' || url.hostname === '127.0.0.1') &&
      !isLocalTokendWeb(url)
    ) {
      return null;
    }

    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length === 0) return null;

    if (parts[0] === 'stream' || parts[0] === 'profile') {
      const slug = parts[1];
      if (slug && !RESERVED_SLUGS.has(slug.toLowerCase())) return slug.toLowerCase();
      return null;
    }

    const candidate = parts[0].replace(/^@/, '').toLowerCase();
    if (RESERVED_SLUGS.has(candidate)) return null;
    if (/^[a-z0-9_-]{2,}$/i.test(candidate)) return candidate;
  } catch {
    // fall through
  }

  return null;
}

export async function fetchTokendMode(): Promise<TokendModeInfo> {
  try {
    const response = await fetch('/api/tokend/mode');
    if (response.ok) {
      const body = await response.json();
      return {
        mode: body.mode,
        configured: body.mode === 'live' || body.mode === 'local',
        message: body.message,
      };
    }
  } catch {
    // fall through
  }
  return { mode: 'mock', configured: false };
}

export async function fetchTokendCatalog(slug: string): Promise<TokendCatalog> {
  try {
    const response = await fetch(`/api/tokend/channels/${encodeURIComponent(slug)}`);
    if (response.ok) {
      return response.json();
    }
  } catch {
    // fall through
  }
  return localFallbackCatalog(slug);
}

function localFallbackCatalog(slug: string): TokendCatalog {
  const normalized = slug.trim().replace(/^@/, '').toLowerCase() || 'seed-nova';
  const seedNames: Record<string, string> = {
    'seed-nova': 'Seed Nova',
    'seed-orbit': 'Seed Orbit',
    'seed-halo': 'Seed Halo',
  };
  const display =
    seedNames[normalized] ||
    normalized
      .split(/[-_]/)
      .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
      .join(' ');

  if (!seedNames[normalized]) {
    return {
      mode: 'mock-local',
      slug: normalized,
      displayName: display,
      note:
        'Unknown slug. Use http://localhost:4100/seed-nova after Tokend local seed-data (not on production tokend.tv).',
      streams: [],
      videos: [],
    };
  }

  return {
    mode: 'mock-local',
    slug: normalized,
    displayName: display,
    note:
      'Clippster fixture (Tokend local seeds). Set TOKEND_API_BASE_URL=http://localhost:4101 for real local catalog.',
    streams:
      normalized === 'seed-nova'
        ? [
            {
              id: 'tokend-vod-dev-seed-nova-vod-launch-retro',
              title: 'Launch dashboard retro and next bets',
              duration: 3600,
              url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
              kind: 'stream',
            },
          ]
        : [
            {
              id: `tokend-vod-dev-seed-${normalized}-1`,
              title: `${display} session 1`,
              duration: 2400,
              url: `http://localhost:4100/${normalized}/vods`,
              kind: 'stream',
            },
          ],
    videos: [
      {
        id: `tokend-clip-${normalized}-1`,
        title: `${display} clip`,
        duration: 45,
        url: `http://localhost:4100/${normalized}/clips`,
        kind: 'video',
      },
    ],
  };
}

export async function checkTokendLivestream(channelOrUrl: string): Promise<TokendLiveStatus> {
  const slug = extractTokendChannel(channelOrUrl) || channelOrUrl.trim().replace(/^@/, '');
  if (!slug) {
    return { isLive: false, error: 'Invalid Tokend channel' };
  }

  try {
    const response = await fetch(`/api/tokend/channels/${encodeURIComponent(slug)}/live`);
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      return { isLive: false, channelId: slug, error: body.error || `Status ${response.status}` };
    }
    return response.json();
  } catch (error) {
    if (slug === 'seed-nova') {
      return {
        mode: 'mock-local',
        isLive: true,
        channelId: slug,
        displayName: 'Seed Nova',
        streamTitle: 'Shipping the creator launch dashboard',
        viewerCount: 2314,
        note: 'Fixture — seed-nova live only exists on local Tokend after seed-data.',
      };
    }
    return {
      isLive: false,
      channelId: slug,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function getTokendVods(
  channelOrUrl: string,
  limit = 20,
  tab: 'streams' | 'videos' = 'streams'
): Promise<TokendVod[]> {
  const slug = extractTokendChannel(channelOrUrl) || channelOrUrl.trim().replace(/^@/, '');
  if (!slug) return [];

  const catalog = await fetchTokendCatalog(slug);
  const items = tab === 'videos' ? catalog.videos : catalog.streams;
  return items.slice(0, limit).map((item) => ({
    videoId: item.id,
    title: item.title,
    duration: item.duration,
    thumbnailUrl: item.thumbnailUrl || undefined,
    uploadDate: item.publishedAt || undefined,
    url: item.url,
    isLive: false,
    kind: item.kind,
  }));
}
