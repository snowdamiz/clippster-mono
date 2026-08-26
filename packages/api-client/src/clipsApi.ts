import type { ApiClient } from './createApiClient';

export interface TranscribeResponse {
  success: boolean;
  transcript?: {
    text?: string;
    duration?: number;
    language?: string;
    segments?: unknown[];
    words?: unknown[];
  };
  error?: string;
  details?: string;
  credits_required?: number;
  credits_remaining?: number;
}

export interface DetectChunkedResponse {
  success: boolean;
  clips?: unknown[];
  jobId?: string;
  transcript?: unknown;
  error?: string;
  details?: string;
  credits_required?: number;
  credits_remaining?: number;
}

export interface JobResponse {
  success: boolean;
  job?: { id: string; status: string };
  error?: string;
}

export function createClipsApi(client: ApiClient) {
  return {
    transcribe(formData: FormData) {
      return client.post<TranscribeResponse>('/clips/transcribe', formData);
    },

    detectChunked(formData: FormData) {
      return client.post<DetectChunkedResponse>('/clips/detect-chunked', formData);
    },

    cancelJob(jobId: string) {
      return client.post<JobResponse>(`/jobs/${jobId}/cancel`);
    },

    cancelByProject(projectId: string) {
      return client.post<JobResponse>('/jobs/cancel-by-project', { project_id: projectId });
    },
  };
}

export type ClipsApi = ReturnType<typeof createClipsApi>;
