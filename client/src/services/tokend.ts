/**
 * Tokend platform client (Stream VODs + Live Clip + connect helpers).
 *
 * Public product host: https://tokend.tv (creator pages at /:slug).
 * Local Tokend web: http://localhost:4100 — API: http://localhost:4101.
 * Seed creators (seed-nova, …) exist only after local Tokend seed-data; not on production.
 *
 * Public catalog/status use Tokend's shipped creator-read routes through Clippster Phoenix.
 * Partner publish/download/watch/OAuth unlock only when Phoenix reports capabilities.
 * Never put OAuth secrets in the desktop client, and never substitute fixtures when Phoenix is unavailable.
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
  source?: string;
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

export interface TokendServerCapabilities {
  public_catalog?: boolean;
  live_status?: boolean;
  oauth_connect?: boolean;
  mock_connect?: boolean;
  publish?: boolean;
  schedule?: boolean;
  download?: boolean;
  watch?: boolean;
  dvr?: boolean;
  analytics?: boolean;
  webhooks?: boolean;
}

export interface TokendModeInfo {
  mode: 'mock' | 'local' | 'live';
  configured: boolean;
  oauth_ready?: boolean;
  oauth_incomplete?: boolean;
  missing_oauth_configuration?: string[];
  capabilities?: TokendServerCapabilities;
  message?: string;
}

/** Defaults when Phoenix has not yet reported a capability matrix. */
export const TOKEND_SHIPPED_CAPABILITIES = {
  publicCatalog: true,
  liveStatus: true,
  publish: false,
  schedule: false,
  download: false,
  playback: false,
  watch: false,
  dvr: false,
  analytics: false,
} as const;

export const TOKEND_UNAVAILABLE_MESSAGES = {
  publish:
    'Tokend publishing and scheduling are unavailable until Phoenix reports partner publish capability (TOKEND_PARTNER_API_ENABLED).',
  download:
    'Tokend media download grants are unavailable until Phoenix reports partner download capability.',
  playback:
    'Tokend playback, Watch, Rec, and DVR are unavailable until Phoenix reports partner watch capability. Live status monitoring remains available.',
  analytics: 'Tokend native analytics are unavailable.',
} as const;

export interface TokendCapabilities {
  mode: TokendModeInfo['mode'];
  modeLabel: string;
  fixtureMode: boolean;
  publicCatalog: boolean;
  liveStatus: boolean;
  oauthConnect: boolean;
  mockConnect: boolean;
  publish: boolean;
  schedule: boolean;
  download: boolean;
  playback: boolean;
  watch: boolean;
  dvr: boolean;
  analytics: boolean;
  webhooks: boolean;
}

export type TokendConnectStrategy = 'mock' | 'oauth' | 'unavailable';

export function getTokendCapabilities(modeInfo: TokendModeInfo): TokendCapabilities {
  const server = modeInfo.capabilities;
  const oauthReady = modeInfo.oauth_ready === true;
  const publish = server?.publish === true || (server?.publish == null && oauthReady);
  const schedule = server?.schedule === true || (server?.schedule == null && oauthReady);
  const download = server?.download === true || (server?.download == null && oauthReady);
  const watch = server?.watch === true || (server?.watch == null && oauthReady);

  return {
    mode: modeInfo.mode,
    modeLabel:
      modeInfo.mode === 'mock'
        ? 'Mock fixtures'
        : modeInfo.mode === 'local'
          ? 'Local Tokend'
          : 'Tokend live',
    fixtureMode: modeInfo.mode === 'mock',
    publicCatalog: server?.public_catalog !== false,
    liveStatus: server?.live_status !== false,
    oauthConnect: server?.oauth_connect === true || (server?.oauth_connect == null && oauthReady),
    mockConnect:
      server?.mock_connect === true ||
      (server?.mock_connect == null && modeInfo.mode === 'mock' && modeInfo.oauth_incomplete !== true),
    publish,
    schedule,
    download,
    playback: watch,
    watch,
    dvr: server?.dvr === true,
    analytics: server?.analytics === true,
    webhooks: server?.webhooks === true,
  };
}

export function getTokendConnectStrategy(modeInfo: TokendModeInfo): TokendConnectStrategy {
  const capabilities = getTokendCapabilities(modeInfo);
  if (capabilities.mockConnect) return 'mock';
  if (capabilities.oauthConnect) return 'oauth';
  return 'unavailable';
}

export function getTokendConnectUnavailableMessage(modeInfo: TokendModeInfo): string {
  if (modeInfo.oauth_incomplete) {
    const missing = modeInfo.missing_oauth_configuration?.join(', ');
    return missing
      ? `Tokend partner OAuth is incomplete. Missing Phoenix configuration: ${missing}.`
      : 'Tokend partner OAuth is incomplete on Phoenix.';
  }
  return (
    modeInfo.message ||
    'Tokend partner OAuth is disabled. Public creator browsing remains available, but account connection requires the opt-in Phoenix partner flag.'
  );
}

export function isTokendPublishPlatform(platformId: string): boolean {
  return platformId.toLowerCase() === 'tokend';
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
    if ((url.hostname === 'localhost' || url.hostname === '127.0.0.1') && !isLocalTokendWeb(url)) {
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
  const response = await fetch('/api/tokend/mode');
  if (!response.ok) {
    throw new Error(await tokendResponseError(response, 'Failed to fetch Tokend mode'));
  }

  const body = await response.json();
  if (!isTokendMode(body.mode)) {
    throw new Error(`Invalid Tokend mode response: ${String(body.mode)}`);
  }

  return {
    mode: body.mode,
    configured: body.configured === true,
    oauth_ready: body.oauth_ready === true,
    oauth_incomplete: body.oauth_incomplete === true,
    missing_oauth_configuration: Array.isArray(body.missing_oauth_configuration)
      ? body.missing_oauth_configuration.filter(
          (value: unknown): value is string => typeof value === 'string'
        )
      : undefined,
    capabilities: isRecord(body.capabilities) ? (body.capabilities as TokendServerCapabilities) : undefined,
    message: typeof body.message === 'string' ? body.message : undefined,
  };
}

export async function fetchTokendCapabilities(): Promise<TokendCapabilities> {
  return getTokendCapabilities(await fetchTokendMode());
}

export async function fetchTokendCatalog(slug: string): Promise<TokendCatalog> {
  const response = await fetch(`/api/tokend/channels/${encodeURIComponent(slug)}`);
  if (!response.ok) {
    throw new Error(await tokendResponseError(response, 'Failed to fetch Tokend catalog'));
  }

  return response.json();
}

export interface TokendVod {
  videoId: string;
  title: string;
  duration?: number;
  thumbnailUrl?: string;
  uploadDate?: string;
  url: string;
  isLive: boolean;
  kind: 'stream' | 'video';
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
    return {
      isLive: false,
      channelId: slug,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

function isTokendMode(value: unknown): value is TokendModeInfo['mode'] {
  return value === 'mock' || value === 'local' || value === 'live';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function tokendResponseError(response: Response, fallback: string): Promise<string> {
  const body = await response.json().catch(() => null);
  if (body && typeof body.error === 'string' && body.error.trim()) {
    return body.error;
  }
  return `${fallback} (status ${response.status})`;
}
