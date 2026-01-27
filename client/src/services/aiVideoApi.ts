import api from './api';
import type { AIGenerationRequest, AIVideoComposition } from '@/types/ai-video';

export async function generateVideoComposition(request: AIGenerationRequest): Promise<AIVideoComposition> {
  const response = await api.post('/ai/generate-video', request);
  return response.data.composition;
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
