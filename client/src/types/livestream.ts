export type SupportedLivestreamPlatform = 'PumpFun';

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
}
