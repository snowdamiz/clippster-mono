export interface HlsSegment {
  url: string;
  duration: number;
}

export interface HlsMediaPlaylist {
  segments: HlsSegment[];
  targetDuration: number;
  totalDuration: number;
}

export interface HlsVariant {
  url: string;
  bandwidth: number;
  resolution?: string;
}

function resolvePlaylistUrl(baseUrl: string, ref: string): string {
  const trimmed = ref.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    return trimmed;
  }
  return new URL(trimmed, baseUrl).toString();
}

function parseAttributes(line: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const raw = line.replace(/^#EXT[^:]+:/, '');
  const re = /([A-Z0-9-]+)=(?:"([^"]*)"|([^,]*))(?:,|$)/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(raw)) != null) {
    attrs[match[1].toUpperCase()] = match[2] ?? match[3] ?? '';
  }
  return attrs;
}

export function isMasterPlaylist(text: string): boolean {
  return text.includes('#EXT-X-STREAM-INF');
}

export function parseMasterVariants(text: string, playlistUrl: string): HlsVariant[] {
  const lines = text.split(/\r?\n/);
  const variants: HlsVariant[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]?.trim();
    if (!line?.startsWith('#EXT-X-STREAM-INF')) continue;
    const attrs = parseAttributes(line);
    const uri = lines[i + 1]?.trim();
    if (!uri || uri.startsWith('#')) continue;
    variants.push({
      url: resolvePlaylistUrl(playlistUrl, uri),
      bandwidth: Number.parseInt(attrs.BANDWIDTH ?? '0', 10) || 0,
      resolution: attrs.RESOLUTION,
    });
  }

  return variants;
}

export function pickBestVariant(variants: HlsVariant[]): HlsVariant | null {
  if (variants.length === 0) return null;
  return variants.reduce((best, current) =>
    current.bandwidth > best.bandwidth ? current : best,
  );
}

function variantHeight(variant: HlsVariant): number {
  const height = variant.resolution?.split('x')[1];
  return Number.parseInt(height ?? '0', 10) || 0;
}

/** Prefer 720p on mobile — 1080p60 HLS is far more bytes than a phone needs. */
export function pickMobileVariant(variants: HlsVariant[]): HlsVariant | null {
  if (variants.length === 0) return null;

  const scored = variants.map((variant) => ({
    variant,
    height: variantHeight(variant),
  }));

  const p720 = scored.filter((item) => item.height >= 700 && item.height <= 800);
  if (p720.length > 0) {
    return p720.reduce((lowest, item) =>
      item.variant.bandwidth < lowest.variant.bandwidth ? item : lowest,
    ).variant;
  }

  const p1080 = scored.filter((item) => item.height >= 1000 && item.height <= 1200);
  if (p1080.length > 0) {
    return p1080.reduce((lowest, item) =>
      item.variant.bandwidth < lowest.variant.bandwidth ? item : lowest,
    ).variant;
  }

  return pickBestVariant(variants);
}

export function parseMediaPlaylist(text: string, playlistUrl: string): HlsMediaPlaylist {
  const lines = text.split(/\r?\n/);
  const segments: HlsSegment[] = [];
  let targetDuration = 0;
  let pendingDuration: number | null = null;
  let pendingMapUrl: string | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (line.startsWith('#EXT-X-TARGETDURATION:')) {
      targetDuration = Number.parseFloat(line.slice('#EXT-X-TARGETDURATION:'.length)) || 0;
      continue;
    }

    if (line.startsWith('#EXT-X-MAP:')) {
      const attrs = parseAttributes(line);
      if (attrs.URI) {
        pendingMapUrl = resolvePlaylistUrl(playlistUrl, attrs.URI);
      }
      continue;
    }

    if (line.startsWith('#EXTINF:')) {
      const value = line.slice('#EXTINF:'.length).split(',')[0];
      pendingDuration = Number.parseFloat(value) || 0;
      continue;
    }

    if (line.startsWith('#')) continue;

    if (pendingMapUrl) {
      segments.push({ url: pendingMapUrl, duration: 0 });
      pendingMapUrl = null;
    }

    segments.push({
      url: resolvePlaylistUrl(playlistUrl, line),
      duration: pendingDuration ?? targetDuration ?? 0,
    });
    pendingDuration = null;
  }

  const totalDuration = segments.reduce((sum, segment) => sum + segment.duration, 0);
  return { segments, targetDuration, totalDuration };
}

export function sliceSegmentsByTime(
  segments: HlsSegment[],
  range?: { startTime: number; endTime: number },
): HlsSegment[] {
  if (!range || range.endTime <= range.startTime) {
    return segments;
  }

  const selected: HlsSegment[] = [];
  let cursor = 0;

  for (const segment of segments) {
    const start = cursor;
    const end = cursor + Math.max(segment.duration, 0);
    cursor = end;
    if (end > range.startTime && start < range.endTime) {
      selected.push(segment);
    }
    if (cursor >= range.endTime) break;
  }

  return selected;
}
