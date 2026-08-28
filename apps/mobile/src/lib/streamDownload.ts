/**
 * Detect URLs that need ffmpeg (HLS/manifest) vs direct HTTP file download.
 * Desktop uses yt-dlp + ffmpeg for these; mobile resolves via server yt-dlp then ffmpeg locally.
 */

export const CHROME_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export function shouldUseFfmpegDownload(url: string): boolean {
  const lower = url.toLowerCase();

  if (/\.(mp4|webm|mov|mkv)(\?|$)/i.test(lower)) {
    return false;
  }

  if (lower.includes('.m3u8')) return true;
  if (lower.includes('stream.kick.com')) return true;
  if (lower.includes('video-weaver')) return true;
  if (lower.includes('playlist.ttvnw.net')) return true;
  if (lower.includes('/manifest')) return true;
  if (lower.includes('/playlist') && !lower.includes('youtube.com')) return true;

  return false;
}

export function getHlsRequestHeaders(
  inputUrl: string,
  pageUrl?: string,
): Record<string, string> {
  const { referer, origin } = resolveHlsReferer(inputUrl, pageUrl);
  return {
    Referer: referer,
    Origin: origin,
    'User-Agent': CHROME_USER_AGENT,
  };
}

function resolveHlsReferer(inputUrl: string, pageUrl?: string): { referer: string; origin: string } {
  const lower = inputUrl.toLowerCase();

  if (lower.includes('kick.com') || lower.includes('stream.kick.com')) {
    return { referer: 'https://kick.com/', origin: 'https://kick.com' };
  }
  if (lower.includes('twitch') || lower.includes('ttvnw')) {
    return { referer: 'https://www.twitch.tv/', origin: 'https://www.twitch.tv' };
  }
  if (lower.includes('youtube') || lower.includes('googlevideo') || lower.includes('youtu.be')) {
    return { referer: 'https://www.youtube.com/', origin: 'https://www.youtube.com' };
  }
  if (lower.includes('twitter') || lower.includes('x.com') || lower.includes('twimg') || lower.includes('video.twimg')) {
    return { referer: 'https://x.com/', origin: 'https://x.com' };
  }
  if (lower.includes('rumble')) {
    return { referer: 'https://rumble.com/', origin: 'https://rumble.com' };
  }
  if (pageUrl) {
    try {
      const parsed = new URL(pageUrl);
      return { referer: `${parsed.origin}/`, origin: parsed.origin };
    } catch {
      // fall through
    }
  }
  return { referer: 'https://kick.com/', origin: 'https://kick.com' };
}

