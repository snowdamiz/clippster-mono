import type { WebClipInput, WebJob, WebProject, WebWorkspace } from '@clippster/shared-types';
import type { ApiClient, RequestOptions } from './createApiClient';

export function createWebProjectsApi(client: ApiClient) {
  async function request<T>(path: string, options?: RequestOptions): Promise<T> {
    const response = await client.requestWithStatus<T & { error?: string }>(`/web${path}`, options);
    if (response.status >= 400)
      throw new Error(response.data?.error || 'The request failed. Please try again.');
    return response.data;
  }
  return {
    list: () => request<{ projects: WebProject[] }>('/projects'),
    create: (name: string) =>
      request<WebWorkspace>('/projects', { method: 'POST', body: { name } }),
    get: (id: string) => request<WebWorkspace>(`/projects/${encodeURIComponent(id)}`),
    remove: (id: string) =>
      request<void>(`/projects/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    importSource: (id: string, url: string) =>
      request<WebJob>(`/projects/${id}/import`, { method: 'POST', body: { url } }),
    detect: (id: string, prompt: string) =>
      request<WebJob>(`/projects/${id}/detect`, { method: 'POST', body: { prompt } }),
    saveClip: (id: string, clip: WebClipInput, clipId?: string, revision?: number) =>
      request<WebWorkspace>(`/projects/${id}/clips${clipId ? `/${clipId}` : ''}`, {
        method: clipId ? 'PUT' : 'POST',
        body: { ...clip, revision },
      }),
    removeClip: (id: string, clipId: string) =>
      request<WebWorkspace>(`/projects/${id}/clips/${clipId}`, { method: 'DELETE' }),
    build: (id: string, clipId: string) =>
      request<WebJob>(`/projects/${id}/clips/${clipId}/build`, { method: 'POST' }),
    cancel: (jobId: string) => request<void>(`/jobs/${jobId}`, { method: 'DELETE' }),
  };
}
