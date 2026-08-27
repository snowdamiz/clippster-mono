export type MediaPlatform =
  | 'youtube'
  | 'kick'
  | 'twitch'
  | 'rumble'
  | 'twitter'
  | 'tokend'
  | 'manual';

export interface MediaStream {
  url: string;
  format: string;
  expires_at: string | null;
}

export interface ResolveUrlResponse {
  success: boolean;
  platform: MediaPlatform;
  title: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  streams: MediaStream[];
  source_id: string | null;
  error?: string;
}

export interface MediaProbeResponse {
  success: boolean;
  platform: MediaPlatform;
  title: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  source_id: string | null;
  error?: string;
}

export interface VodListItem {
  id: string | null;
  title: string | null;
  duration_seconds: number | null;
  thumbnail_url: string | null;
  url: string | null;
  upload_date?: string | number | null;
  /** Channel / uploader label shown in VOD card meta (desktop parity). */
  uploader?: string | null;
  views?: number | null;
  /** Direct stream URL (HLS/mp4) for download — desktop uses playlistUrl, not the page URL. */
  download_url?: string | null;
}

export interface ListVodsResponse {
  success: boolean;
  platform: MediaPlatform;
  channel: string;
  vods: VodListItem[];
  error?: string;
}
