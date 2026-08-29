import api from './api';

export type ThumbnailGenerationMode = 'quick' | 'editable';

export interface ThumbnailSessionSummary {
  id: number;
  name: string | null;
  status: string;
  generation_mode: ThumbnailGenerationMode;
  thumbnail_url: string | null;
  updated_at: string;
  inserted_at: string;
}

export interface ThumbnailMessage {
  id: number;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: Record<string, unknown> | null;
  inserted_at: string;
}

export interface ThumbnailCandidate {
  url: string;
  width?: number;
  height?: number;
  [key: string]: unknown;
}

export interface ThumbnailRecipeTextLayer {
  id?: string;
  content: string;
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string | number;
  color?: string;
  stroke?: { color?: string; width?: number };
  shadow?: { color?: string; blur?: number; offsetX?: number; offsetY?: number };
  x?: number;
  y?: number;
  align?: string;
  [key: string]: unknown;
}

export interface ThumbnailRecipe {
  canvas?: { width: number; height: number; aspect_ratio?: string };
  layers?: Array<
    | { type: 'plate' | 'image'; url?: string; mediaId?: string; [key: string]: unknown }
    | ({ type: 'text' } & ThumbnailRecipeTextLayer)
    | { type: 'shape'; shape?: string; [key: string]: unknown }
  >;
  text_layers?: ThumbnailRecipeTextLayer[];
  shapes?: Array<Record<string, unknown>>;
  [key: string]: unknown;
}

export interface AIThumbnailSession {
  id: number;
  name: string | null;
  status: string;
  generation_mode: ThumbnailGenerationMode;
  media_items: Array<Record<string, unknown>>;
  key_frames: Array<Record<string, unknown>>;
  reference_image_url: string | null;
  reference_image_meta: Record<string, unknown> | null;
  brief_summary: Record<string, unknown> | null;
  candidates: ThumbnailCandidate[];
  plate_url: string | null;
  recipe: ThumbnailRecipe | null;
  composition: Record<string, unknown> | null;
  result: Record<string, unknown> | null;
  thumbnail_url: string | null;
  refinement_round: number;
  refinement_messages_used: number;
  max_refinement_rounds: number;
  max_messages_per_round: number;
  canvas_width: number;
  canvas_height: number;
  messages: ThumbnailMessage[];
  inserted_at: string;
  updated_at: string;
}

export async function listThumbnailSessions(): Promise<ThumbnailSessionSummary[]> {
  const response = await api.get('/ai/thumbnail/sessions');
  return response.data.sessions;
}

export async function createThumbnailSession(data: {
  name?: string;
  generation_mode?: ThumbnailGenerationMode;
  media_items?: Array<Record<string, unknown>>;
  key_frames?: Array<Record<string, unknown>>;
  canvas_width?: number;
  canvas_height?: number;
} = {}): Promise<AIThumbnailSession> {
  const response = await api.post('/ai/thumbnail/sessions', data);
  return response.data;
}

export async function getThumbnailSession(id: number): Promise<AIThumbnailSession> {
  const response = await api.get(`/ai/thumbnail/sessions/${id}`);
  return response.data;
}

export async function deleteThumbnailSession(id: number): Promise<void> {
  await api.delete(`/ai/thumbnail/sessions/${id}`);
}

export async function renameThumbnailSession(id: number, name: string): Promise<void> {
  await api.put(`/ai/thumbnail/sessions/${id}/name`, { name });
}

export async function setThumbnailMode(
  id: number,
  generation_mode: ThumbnailGenerationMode,
): Promise<AIThumbnailSession> {
  const response = await api.put(`/ai/thumbnail/sessions/${id}/mode`, { generation_mode });
  return response.data;
}

export async function updateThumbnailMedia(
  id: number,
  data: {
    media_items?: Array<Record<string, unknown>>;
    key_frames?: Array<Record<string, unknown>>;
    canvas_width?: number;
    canvas_height?: number;
  },
): Promise<AIThumbnailSession> {
  const response = await api.put(`/ai/thumbnail/sessions/${id}/media`, data);
  return response.data;
}

export async function setThumbnailReference(
  id: number,
  data: { reference_image_url?: string; url?: string; meta?: Record<string, unknown> },
): Promise<AIThumbnailSession> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/reference`, data);
  return response.data;
}

export async function sendThumbnailMessage(
  id: number,
  message: string,
): Promise<{ session: AIThumbnailSession; response: Record<string, unknown> }> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/message`, { message });
  return response.data;
}

export async function generateThumbnail(
  id: number,
  generation_mode?: ThumbnailGenerationMode,
): Promise<AIThumbnailSession> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/generate`, {
    generation_mode,
  });
  return response.data;
}

export async function refineThumbnail(
  id: number,
  message: string,
): Promise<{ session: AIThumbnailSession; response: Record<string, unknown> }> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/refine`, { message });
  return response.data;
}

export async function acceptThumbnail(
  id: number,
  candidate_index = 0,
): Promise<{ session: AIThumbnailSession; accept: Record<string, unknown> }> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/accept`, { candidate_index });
  return response.data;
}
