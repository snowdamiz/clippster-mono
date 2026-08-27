export interface KickClip {
  clipId: string;
  sessionId: string;
  title: string;
  duration: number;
  thumbnailUrl?: string;
  playlistUrl?: string;
  pageUrl?: string;
  mp4Url?: string | null;
  clipType: string;
  startTime?: string;
  createdAt?: string;
  isLive?: boolean;
  views?: number;
}

export interface KickClipsResponse {
  success: boolean;
  clips: KickClip[];
  hasMore: boolean;
  total: number;
  error?: string;
}

export function createKickApi(client: { get: <T>(path: string) => Promise<T> }) {
  return {
    getClips(channelSlug: string, limit = 20) {
      const params = new URLSearchParams({ limit: String(limit) });
      return client.get<KickClipsResponse>(
        `/kick/channels/${encodeURIComponent(channelSlug)}/videos?${params.toString()}`,
      );
    },
  };
}

export type KickApi = ReturnType<typeof createKickApi>;
