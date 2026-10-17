export function creatorChannelId(source: { sourcePlatform?: string; sourceChannel?: string; sourceUrl?: string | null }): string {
  const input = source.sourceChannel || source.sourceUrl || '';
  const extractors: Record<string, (value: string) => string | null> = { kick: extractChannelSlug, twitch: extractChannelName, youtube: extractYouTubeChannel, rumble: extractRumbleChannel, pumpfun: extractMintId };
  const extracted = extractors[source.sourcePlatform || '']?.(input);
  if (extracted) return extracted.toLowerCase();
  if (!input.includes('://')) return input.trim().toLowerCase();
  try { return new URL(input).pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '').toLowerCase() || ''; } catch { return ''; }
}

export function extractMintId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // If it looks like a mint ID already (base58-like string), return as-is
  // Mint IDs are typically 43-44 characters and contain specific characters
  if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(trimmed)) {
    return trimmed;
  }

  // Try to parse as URL and extract mint ID
  try {
    const url = new URL(trimmed);

    // Check if it's a pump.fun domain
    if (!url.hostname.includes('pump.fun')) {
      return null;
    }

    // Extract path segments and look for mint ID
    const pathSegments = url.pathname.split('/').filter((segment) => segment.length > 0);

    // Look for patterns like /coin/{mintId} or /base/{mintId}
    for (let i = 0; i < pathSegments.length - 1; i++) {
      const segment = pathSegments[i];
      const nextSegment = pathSegments[i + 1];

      // Check if this segment indicates a mint ID follows
      if (segment === 'coin' || segment === 'base' || segment === 'mint') {
        const potentialMintId = nextSegment;
        if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(potentialMintId)) {
          return potentialMintId;
        }
      }
    }

    // If no explicit segment found, look for mint-like strings in the path
    for (const segment of pathSegments) {
      if (/^[1-9A-HJ-NP-Za-km-z]{43,44}$/.test(segment)) {
        return segment;
      }
    }

    return null;
  } catch {
    // Invalid URL, check if it might be a mint ID that doesn't match the pattern
    return /^[1-9A-HJ-NP-Za-km-z]+$/.test(trimmed) ? trimmed : null;
  }
}

export function extractChannelSlug(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('kick.com')) {
        return null;
      }

      const parts = url.pathname.split('/').filter((p) => p.length > 0);
      if (parts.length > 0) {
        if (parts[0] === 'video') return null;
        return parts[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  // Basic slug validation
  if (/^[a-zA-Z0-9_-]{3,}$/.test(trimmed)) {
    return trimmed;
  }

  return null;
}

export function extractChannelName(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('twitch.tv')) {
        return null;
      }

      const parts = url.pathname.split('/').filter((p) => p.length > 0);
      if (parts.length > 0) {
        // Skip paths like /videos/123456
        if (parts[0] === 'videos') return null;
        return parts[0];
      }
      return null;
    } catch {
      return null;
    }
  }

  // Basic channel name validation (alphanumeric + underscore, 4-25 chars)
  if (/^[a-zA-Z0-9_]{4,25}$/.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

export function extractYouTubeChannel(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // If it's a video URL, return null (not a channel)
  if (extractYouTubeVideoId(trimmed)) {
    return null;
  }

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('youtube.com') && !url.hostname.includes('youtu.be')) {
        return null;
      }

      // Handle /channel/UC... format
      if (url.pathname.includes('/channel/')) {
        const parts = url.pathname.split('/channel/');
        if (parts.length > 1) {
          return parts[1].split('/')[0];
        }
      }

      // Handle /@username format
      if (url.pathname.includes('/@')) {
        const parts = url.pathname.split('/@');
        if (parts.length > 1) {
          return '@' + parts[1].split('/')[0];
        }
      }

      // Handle /user/username format
      if (url.pathname.includes('/user/')) {
        const parts = url.pathname.split('/user/');
        if (parts.length > 1) {
          return parts[1].split('/')[0];
        }
      }

      // Handle legacy/custom channel paths like youtube.com/DilanJay or youtube.com/DilanJay/videos
      const [firstPathPart] = url.pathname.split('/').filter(Boolean);
      if (
        firstPathPart &&
        !['watch', 'shorts', 'embed', 'live', 'playlist', 'feed', 'results', 'redirect'].includes(firstPathPart)
      ) {
        return firstPathPart;
      }

      return null;
    } catch {
      return null;
    }
  }

  // Handle @username format
  if (trimmed.startsWith('@')) {
    return trimmed;
  }

  // Handle UC... channel ID format
  if (trimmed.startsWith('UC') && trimmed.length === 24) {
    return trimmed;
  }

  return trimmed;
}

export function extractRumbleChannel(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // If it's a video URL, return null (not a channel)
  if (extractRumbleVideoId(trimmed)) {
    return null;
  }

  // URL parsing
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (!url.hostname.includes('rumble.com')) {
        return null;
      }

      // Handle /c/channelname format
      if (url.pathname.includes('/c/')) {
        const parts = url.pathname.split('/c/');
        if (parts.length > 1) {
          return 'c/' + parts[1].split('/')[0];
        }
      }

      // Handle /user/channelname format
      if (url.pathname.includes('/user/')) {
        const parts = url.pathname.split('/user/');
        if (parts.length > 1) {
          return 'user/' + parts[1].split('/')[0];
        }
      }

      // Handle direct channel paths like /ChannelName or /SomeChannel
      // Exclude known non-channel paths (videos, browse, search, etc.)
      const pathSegments = url.pathname.split('/').filter((p) => p.length > 0);
      if (pathSegments.length === 1) {
        const segment = pathSegments[0];
        // Video URLs start with 'v' followed by alphanumeric and contain a dash (e.g., v1abc-title.html)
        if (/^v[a-z0-9]+-/.test(segment)) {
          return null;
        }
        // Skip known non-channel top-level paths
        const nonChannelPaths = ['browse', 'search', 'login', 'register', 'account', 'about', 'contact', 'terms', 'privacy', 'embed', 'playlists'];
        if (nonChannelPaths.includes(segment.toLowerCase())) {
          return null;
        }
        // Treat as a direct channel name
        return segment;
      }

      return null;
    } catch {
      return null;
    }
  }

  // Plain channel name — assume /c/ format
  return trimmed;
}
export function extractYouTubeVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // youtube.com/watch?v=VIDEO_ID
  if (trimmed.includes('watch?v=')) {
    const match = trimmed.match(/watch\?v=([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  // youtu.be/VIDEO_ID
  if (trimmed.includes('youtu.be/')) {
    const match = trimmed.match(/youtu\.be\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  // youtube.com/shorts/VIDEO_ID
  if (trimmed.includes('/shorts/')) {
    const match = trimmed.match(/\/shorts\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  // youtube.com/embed/VIDEO_ID
  if (trimmed.includes('/embed/')) {
    const match = trimmed.match(/\/embed\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  // youtube.com/v/VIDEO_ID
  if (trimmed.includes('/v/')) {
    const match = trimmed.match(/\/v\/([a-zA-Z0-9_-]{11})/);
    if (match) return match[1];
  }

  // Direct 11-character video ID
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed) && !trimmed.includes('/') && !trimmed.startsWith('@')) {
    return trimmed;
  }

  return null;
}

export function extractRumbleVideoId(input: string): string | null {
  if (!input || typeof input !== 'string') {
    return null;
  }

  const trimmed = input.trim();

  // rumble.com/v[id]-title.html format
  if (trimmed.includes('/v')) {
    const match = trimmed.match(/\/v([a-z0-9]+)[-\.]/i);
    if (match) return 'v' + match[1];
  }

  // rumble.com/embed/v[id] format
  if (trimmed.includes('/embed/v')) {
    const match = trimmed.match(/\/embed\/v([a-z0-9]+)/i);
    if (match) return 'v' + match[1];
  }

  // Direct video ID (starts with 'v' followed by alphanumeric)
  if (/^v[a-z0-9]+$/i.test(trimmed)) {
    return trimmed;
  }

  return null;
}
