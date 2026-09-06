import api from './api';

export type ThumbnailGenerationMode = 'quick' | 'editable';
export type TranscriptSource = 'existing' | 'youtube_captions' | 'whisper';

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

export interface ThumbnailConcept {
  id: string;
  title: string;
  description?: string;
  prompt: string;
  hook_text?: string;
  text_style?: string;
  text_placement?: string;
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
  youtube_url?: string | null;
  video_title?: string | null;
  transcript?: string | null;
  transcript_source?: TranscriptSource | string | null;
  concepts?: ThumbnailConcept[];
  video_summary?: Record<string, unknown> | null;
  selected_concept_id?: string | null;
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
    youtube_url?: string | null;
    video_title?: string | null;
    transcript?: string | null;
    transcript_source?: string | null;
    concepts?: ThumbnailConcept[];
    video_summary?: Record<string, unknown> | null;
    selected_concept_id?: string | null;
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

export async function generateThumbnailFromVideo(
  id: number,
  data: {
    variant_count?: 4 | 8 | 12;
    custom_instructions?: string;
    concept_id?: string;
    aspect_ratio?: string;
  } = {},
): Promise<AIThumbnailSession> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/generate-from-video`, data);
  return response.data;
}

export async function continueThumbnailEditable(
  id: number,
  candidate_index = 0,
): Promise<AIThumbnailSession> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/continue-editable`, {
    candidate_index,
  });
  return response.data;
}

export async function analyzeThumbnailVideo(
  id: number,
): Promise<{ session: AIThumbnailSession; concepts: ThumbnailConcept[]; summary: string }> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/analyze`);
  return response.data;
}

export async function applyThumbnailConcept(
  id: number,
  concept_id: string,
): Promise<AIThumbnailSession> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/apply-concept`, { concept_id });
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

async function postgen<T = Record<string, unknown>>(
  id: number,
  path: string,
  body: Record<string, unknown> = {},
): Promise<T & { session: AIThumbnailSession }> {
  const response = await api.post(`/ai/thumbnail/sessions/${id}/${path}`, body);
  return response.data;
}

export const thumbnailPostGen = {
  critique: (id: number, body: Record<string, unknown> = {}) => postgen(id, 'critique', body),
  variations: (id: number, body: Record<string, unknown> = {}) => postgen(id, 'variations', body),
  optimize: (id: number, idea: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'optimize', { idea, ...body }),
  textOverlay: (id: number, body: Record<string, unknown> = {}) => postgen(id, 'text-overlay', body),
  edit: (id: number, prompt: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit', { prompt, ...body }),
  faceSwap: (id: number, faceImageUrl: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit/face-swap', { faceImageUrl, ...body }),
  backgroundRemove: (id: number, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit/background-remove', body),
  backgroundReplace: (id: number, backgroundPrompt: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit/background-replace', { backgroundPrompt, ...body }),
  colorEnhance: (id: number, preset: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit/color-enhance', { preset, ...body }),
  upscale: (id: number, scale: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit/upscale', { scale, ...body }),
  filter: (id: number, filterPrompt: string, body: Record<string, unknown> = {}) =>
    postgen(id, 'edit/filter', { filterPrompt, ...body }),
  combine: (
    id: number,
    imageUrl1: string,
    imageUrl2: string,
    prompt?: string,
    body: Record<string, unknown> = {},
  ) => postgen(id, 'edit/combine', { imageUrl1, imageUrl2, prompt, ...body }),
};
