import api from './api';
import type {
  AiBrollSearchResponse,
  AiBrollSuggestRequest,
  AiBrollSuggestResponse,
  AiBrollProvider,
} from '@/types/ai-broll';

export async function suggestAiBroll(
  request: AiBrollSuggestRequest,
): Promise<AiBrollSuggestResponse> {
  const response = await api.post<AiBrollSuggestResponse>('/ai/broll/suggest', request);
  return response.data;
}

export async function searchAiBrollStock(params: {
  query: string;
  provider?: AiBrollProvider;
  orientation?: 'portrait' | 'landscape' | 'square';
  mediaType?: 'image' | 'video';
  page?: number;
  perPage?: number;
}): Promise<AiBrollSearchResponse> {
  const response = await api.get<AiBrollSearchResponse>('/ai/broll/search', {
    params: {
      query: params.query,
      provider: params.provider,
      orientation: params.orientation ?? 'portrait',
      media_type: params.mediaType ?? 'video',
      page: params.page ?? 1,
      per_page: params.perPage ?? 8,
    },
  });
  return response.data;
}

export function isAiBrollConfigured(): boolean {
  return true;
}
