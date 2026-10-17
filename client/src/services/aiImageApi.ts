import api from './api';
import type { ThumbnailCandidate, ThumbnailMessage } from './aiThumbnailApi';

export interface AIImageSessionSummary {
  id: number;
  name: string | null;
  status: string;
  creator_mode: 'image' | 'thumbnail';
  generation_mode?: 'editable' | 'quick' | null;
  thumbnail_url: string | null;
  updated_at: string;
  inserted_at: string;
}

export interface AIImageSession {
  id: number;
  name: string | null;
  status: string;
  creator_mode: 'image';
  candidates: ThumbnailCandidate[];
  thumbnail_url: string | null;
  composition: Record<string, unknown> | null;
  brief_summary: {
    generation_prompt?: string;
    edit_prompt?: string;
    aspect_ratio?: string;
    visual_reference_urls?: string[];
  } | null;
  canvas_width: number;
  canvas_height: number;
  messages: ThumbnailMessage[];
  inserted_at: string;
  updated_at: string;
}

export async function listImageSessions(): Promise<AIImageSessionSummary[]> {
  const response = await api.get('/ai/image/sessions');
  return response.data.sessions;
}

export async function createImageSession(name?: string): Promise<AIImageSession> {
  const response = await api.post('/ai/image/sessions', { name });
  return response.data;
}

export async function getImageSession(id: number): Promise<AIImageSession> {
  const response = await api.get(`/ai/image/sessions/${id}`);
  return response.data;
}

export async function deleteImageSession(id: number): Promise<void> {
  await api.delete(`/ai/image/sessions/${id}`);
}

export async function renameImageSession(id: number, name: string): Promise<void> {
  await api.put(`/ai/image/sessions/${id}/name`, { name });
}

export async function sendImageMessage(
  id: number,
  message: string
): Promise<{ session: AIImageSession; response: Record<string, unknown> }> {
  const response = await api.post(`/ai/image/sessions/${id}/message`, { message });
  return response.data;
}

export async function prepareImagePrompt(
  id: number
): Promise<{ session: AIImageSession; prompt: string; aspect_ratio: string }> {
  const response = await api.post(`/ai/image/sessions/${id}/prepare-prompt`);
  return response.data;
}

export async function generateImage(id: number): Promise<AIImageSession> {
  const response = await api.post(`/ai/image/sessions/${id}/generate`);
  return response.data;
}

export async function prepareImageRevision(
  id: number
): Promise<{ session: AIImageSession; prompt: string; aspect_ratio: string }> {
  const response = await api.post(`/ai/image/sessions/${id}/prepare-revision`);
  return response.data;
}

export async function reviseImage(id: number): Promise<AIImageSession> {
  const response = await api.post(`/ai/image/sessions/${id}/revise`);
  return response.data;
}

export async function selectImageCandidate(
  id: number,
  candidateIndex: number
): Promise<AIImageSession> {
  const response = await api.post(`/ai/image/sessions/${id}/select-candidate`, {
    candidate_index: candidateIndex,
  });
  return response.data;
}
