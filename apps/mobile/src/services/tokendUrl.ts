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

/** Parse partner media type + id from a Tokend catalog id or URL. */
export function parseTokendMediaRef(input: string): { type: string; id: string } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const idMatch = trimmed.match(/(?:tokend-)?(vod|stream|clip|video)[-_]?(.+)$/i);
  if (idMatch && !trimmed.includes('/') && !trimmed.includes('://')) {
    const kind = idMatch[1].toLowerCase();
    const type = kind === 'vod' || kind === 'stream' ? 'streams' : 'videos';
    return { type, id: trimmed };
  }

  try {
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const url = new URL(withProto);
    const parts = url.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && (parts[0] === 'stream' || parts[0] === 'vod' || parts[0] === 'video')) {
      const type = parts[0] === 'video' || parts[0] === 'vod' ? 'videos' : 'streams';
      return { type, id: parts[1] };
    }
    if (parts.length >= 1) {
      return { type: 'streams', id: parts[parts.length - 1] };
    }
  } catch {
    // fall through
  }

  return { type: 'streams', id: trimmed };
}
