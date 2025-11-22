export type SupportedLivestreamPlatform = 'PumpFun' | 'Youtube' | 'Twitch' | 'Kick';

export interface MonitoredStreamer {
  id: string;
  mintId: string;
  displayName: string;
  platform: SupportedLivestreamPlatform;
  lastCheckTimestamp: number | null;
  isCurrentlyLive: boolean;
  currentSessionId: string | null;
  selected: boolean;
  isDetecting: boolean;
  profileImageUrl?: string;
  streamThumbnailUrl?: string;
}

export interface LiveStatus {
  isLive: boolean;
  streamId?: string | number;
  streamStartTimestamp?: number | null;
  numParticipants?: number;
  roomName?: string;
  regionUrl?: string;
  token?: string;
  raw?: Record<string, any>;
}

export interface LiveSession {
  sessionId: string;
  streamerId: string;
  mintId: string;
  startedAt: number;
  streamStartTime: number;
  totalSegments: number;
  processedSegments: number;
  isRecording: boolean;
  projectId: string;
  // Display info for logs
  displayName: string;
  platform: SupportedLivestreamPlatform;
  profileImageUrl?: string;
  detectClips?: boolean;
  isStopping?: boolean;
}

export interface SegmentEventPayload {
  sessionId: string;
  streamerId: string;
  mintId: string;
  segment: number;
  path: string;
  duration: number;
  startedAt?: number;
}

export interface SegmentJob {
  sessionId: string;
  segmentId: string;
  segmentNumber: number;
  streamerId: string;
  mintId: string;
  filePath: string;
  projectId: string;
  detectClips?: boolean;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  streamerId: string;
  streamerName: string;
  platform: SupportedLivestreamPlatform;
  message: string;
  status: 'loading' | 'success' | 'info';
  mintId?: string;
  profileImageUrl?: string;
  streamThumbnailUrl?: string;
}
