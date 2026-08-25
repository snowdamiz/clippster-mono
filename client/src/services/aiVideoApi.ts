import type { AIVideoComposition, AIVideoTrack } from '@/types/ai-video';

export interface ScenePlanEvent {
  scenes: Array<{
    index: number;
    description: string;
    startTime: number;
    endTime: number;
    mediaPaths?: string[];
    mood?: string;
  }>;
  total: number;
}

export interface SceneCompleteEvent {
  index: number;
  total: number;
  tracks: AIVideoTrack[];
  description?: string;
}

export interface StreamCallbacks {
  onPlan?: (event: ScenePlanEvent) => void;
  onScene?: (event: SceneCompleteEvent) => void;
  onComplete?: (event: { composition: AIVideoComposition }) => void;
  onError?: (event: { message: string }) => void;
}
