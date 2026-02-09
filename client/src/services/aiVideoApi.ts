import api from './api';
import type { AIGenerationRequest, AIVideoComposition, AIVideoTrack } from '@/types/ai-video';
import { useAuthStore } from '@/stores/auth';

// SSE event types for scene-by-scene generation
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

export interface GenerationCompleteEvent {
  composition: AIVideoComposition;
}

export interface GenerationErrorEvent {
  message: string;
}

export interface StreamCallbacks {
  onPlan?: (event: ScenePlanEvent) => void;
  onScene?: (event: SceneCompleteEvent) => void;
  onComplete?: (event: GenerationCompleteEvent) => void;
  onError?: (event: GenerationErrorEvent) => void;
}

// Non-streaming fallback (backwards-compatible)
export async function generateVideoComposition(request: AIGenerationRequest): Promise<AIVideoComposition> {
  const response = await api.post('/ai/generate-video', request);
  return response.data.composition;
}

// SSE streaming generation — returns the final composition, calls callbacks for progress
export async function generateVideoCompositionStreamed(
  request: AIGenerationRequest,
  callbacks: StreamCallbacks
): Promise<AIVideoComposition> {
  const authStore = useAuthStore();
  const token = authStore.token || localStorage.getItem('auth_token');
  const baseUrl = api.defaults.baseURL || 'http://localhost:4000/api';

  const response = await fetch(`${baseUrl}/ai/generate-video-streamed`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(request),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Generation failed: ${response.status} ${errorText}`);
  }

  if (!response.body) {
    throw new Error('No response body for SSE stream');
  }

  return new Promise<AIVideoComposition>((resolve, reject) => {
    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let finalComposition: AIVideoComposition | null = null;
    let streamError: string | null = null;

    function processSSEBuffer() {
      // Split buffer into complete SSE messages (separated by double newline)
      const messages = buffer.split('\n\n');
      // Keep the last incomplete chunk in the buffer
      buffer = messages.pop() || '';

      for (const message of messages) {
        if (!message.trim()) continue;

        let eventType = '';
        let eventData = '';

        for (const line of message.split('\n')) {
          if (line.startsWith('event: ')) {
            eventType = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            eventData = line.slice(6);
          }
        }

        if (!eventType || !eventData) continue;

        try {
          const data = JSON.parse(eventData);

          switch (eventType) {
            case 'plan':
              callbacks.onPlan?.(data as ScenePlanEvent);
              break;
            case 'scene':
              callbacks.onScene?.(data as SceneCompleteEvent);
              break;
            case 'complete':
              finalComposition = data.composition as AIVideoComposition;
              callbacks.onComplete?.(data as GenerationCompleteEvent);
              break;
            case 'error':
              streamError = (data as GenerationErrorEvent).message || 'Generation failed';
              callbacks.onError?.(data as GenerationErrorEvent);
              break;
            case 'done':
              // Stream finished
              break;
          }
        } catch (e) {
          console.warn('[aiVideoApi] Failed to parse SSE event:', eventType, eventData, e);
        }
      }
    }

    async function readStream() {
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          processSSEBuffer();

          // If we received an error event, stop reading immediately
          if (streamError) {
            reader.cancel();
            break;
          }
        }

        // Process any remaining buffer
        if (buffer.trim()) {
          buffer += '\n\n';
          processSSEBuffer();
        }

        if (streamError) {
          reject(new Error(streamError));
        } else if (finalComposition) {
          resolve(finalComposition);
        } else {
          reject(new Error('Stream ended without a complete composition'));
        }
      } catch (err) {
        reject(err);
      }
    }

    readStream();
  });
}

export async function saveComposition(composition: AIVideoComposition): Promise<{ id: string }> {
  const response = await api.post('/ai/compositions', { composition });
  return response.data;
}

export async function getComposition(id: string): Promise<AIVideoComposition> {
  const response = await api.get(`/ai/compositions/${id}`);
  return response.data.composition;
}

export async function listCompositions(): Promise<AIVideoComposition[]> {
  const response = await api.get('/ai/compositions');
  return response.data.compositions;
}

export async function deleteComposition(id: string): Promise<void> {
  await api.delete(`/ai/compositions/${id}`);
}
