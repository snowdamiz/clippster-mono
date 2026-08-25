import api from './api';
import { useAuthStore } from '@/stores/auth';
import type {
  AIChatSession,
  AIVideoMediaItem,
  AIVideoComposition,
  ChatResponse,
  RefinementResponse,
  ReferenceEditRecipe,
  StylePackRecipe,
  MediaAnalysis,
} from '@/types/ai-video';
import type { StreamCallbacks } from './aiVideoApi';

// ---------------------------------------------------------------------------
// Session CRUD
// ---------------------------------------------------------------------------

export interface SessionSummary {
  id: number;
  name: string | null;
  status: string;
  thumbnail_url: string | null;
  updated_at: string;
  inserted_at: string;
}

export async function listChatSessions(): Promise<SessionSummary[]> {
  const response = await api.get('/ai/chat/sessions');
  return response.data.sessions;
}

export async function createChatSession(mediaItems: AIVideoMediaItem[] = []): Promise<AIChatSession> {
  const response = await api.post('/ai/chat/sessions', { media_items: mediaItems });
  return response.data;
}

export async function getChatSession(sessionId: number): Promise<AIChatSession> {
  const response = await api.get(`/ai/chat/sessions/${sessionId}`);
  return response.data;
}

export async function deleteChatSession(sessionId: number): Promise<void> {
  await api.delete(`/ai/chat/sessions/${sessionId}`);
}

export async function renameChatSession(sessionId: number, name: string): Promise<void> {
  await api.put(`/ai/chat/sessions/${sessionId}/name`, { name });
}

// ---------------------------------------------------------------------------
// Discovery chat
// ---------------------------------------------------------------------------

export async function sendChatMessage(
  sessionId: number,
  message: string
): Promise<{ session: AIChatSession; response: ChatResponse }> {
  const response = await api.post(`/ai/chat/sessions/${sessionId}/message`, { message });
  return response.data;
}

// ---------------------------------------------------------------------------
// Generation (SSE streaming)
// ---------------------------------------------------------------------------

export async function triggerGeneration(
  sessionId: number,
  callbacks: StreamCallbacks,
  overrides?: { style?: string; duration?: number; aspectRatio?: string },
  signal?: AbortSignal
): Promise<AIVideoComposition> {
  const authStore = useAuthStore();
  const token = authStore.token || localStorage.getItem('auth_token');
  const baseUrl =
    api.defaults.baseURL ||
    (import.meta.env.DEV ? 'http://localhost:4000/api' : 'https://api.clippster.app/api');

  const response = await fetch(`${baseUrl}/ai/chat/sessions/${sessionId}/generate`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(overrides || {}),
    signal,
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMsg = `Generation failed: ${response.status}`;
    try {
      const errorJson = JSON.parse(errorText);
      errorMsg = errorJson.error || errorMsg;
    } catch {
      errorMsg = errorText || errorMsg;
    }
    throw new Error(errorMsg);
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
      const messages = buffer.split('\n\n');
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
              callbacks.onPlan?.(data);
              break;
            case 'scene':
              callbacks.onScene?.(data);
              break;
            case 'complete':
              finalComposition = data.composition as AIVideoComposition;
              callbacks.onComplete?.(data);
              break;
            case 'error':
              streamError = data.message || 'Generation failed';
              callbacks.onError?.(data);
              break;
            case 'done':
              break;
          }
        } catch (e) {
          console.warn('[aiChatApi] Failed to parse SSE event:', eventType, eventData, e);
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

          if (streamError) {
            reader.cancel();
            break;
          }
        }

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

// ---------------------------------------------------------------------------
// Refinement
// ---------------------------------------------------------------------------

export async function sendRefinement(
  sessionId: number,
  message: string
): Promise<{
  session: AIChatSession;
  response: RefinementResponse;
  composition: AIVideoComposition | null;
}> {
  const response = await api.post(`/ai/chat/sessions/${sessionId}/refine`, { message });
  return response.data;
}

// ---------------------------------------------------------------------------
// Reference & media analysis
// ---------------------------------------------------------------------------

export async function uploadReference(
  sessionId: number,
  referenceAnalysis: ReferenceEditRecipe | null,
  referenceUrl: string | null = null
): Promise<AIChatSession> {
  const response = await api.post(`/ai/chat/sessions/${sessionId}/reference`, {
    reference_analysis: referenceAnalysis,
    reference_url: referenceUrl,
  });
  return response.data;
}

export async function updateStylePack(
  sessionId: number,
  stylePack: StylePackRecipe
): Promise<AIChatSession> {
  const response = await api.put(`/ai/chat/sessions/${sessionId}/style`, { style_pack: stylePack });
  return response.data;
}

export async function uploadMediaAnalysis(
  sessionId: number,
  mediaAnalysis: MediaAnalysis[]
): Promise<AIChatSession> {
  const response = await api.post(`/ai/chat/sessions/${sessionId}/media-analysis`, {
    media_analysis: mediaAnalysis,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// Update media items
// ---------------------------------------------------------------------------

export async function updateSessionMedia(
  sessionId: number,
  mediaItems: AIVideoMediaItem[]
): Promise<void> {
  await api.put(`/ai/chat/sessions/${sessionId}/media`, { media_items: mediaItems });
}
