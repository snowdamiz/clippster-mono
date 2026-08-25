import { Channel, invoke } from '@tauri-apps/api/core';
import api from './api';
import type {
  ReferenceAnalysisPayload,
  ReferenceAnalysisProgress,
  ReferenceEditRecipe,
} from '@/types/ai-video';

export type ReferenceInput = { kind: 'url' | 'upload'; value: string };

export async function analyzeReferenceVideo(
  input: ReferenceInput,
  onProgress: (progress: ReferenceAnalysisProgress) => void,
  signal?: AbortSignal
): Promise<ReferenceEditRecipe> {
  signal?.throwIfAborted();
  const jobId = crypto.randomUUID();
  const channel = new Channel<ReferenceAnalysisProgress>();
  channel.onmessage = onProgress;

  const cancel = () => void invoke('cancel_reference_analysis', { jobId });
  signal?.addEventListener('abort', cancel, { once: true });

  try {
    const evidence = await invoke<ReferenceAnalysisPayload>('prepare_reference_video', {
      input: { jobId, ...input },
      onEvent: channel,
    });

    if (signal?.aborted) throw new DOMException('Reference analysis cancelled', 'AbortError');
    onProgress({ stage: 'model', progress: 82, message: 'Learning the edit recipe' });

    const response = await api.post('/ai/reference/analyze', evidence, { signal });
    onProgress({ stage: 'complete', progress: 100, message: 'Reference recipe ready' });
    return response.data.edit_recipe;
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
}
