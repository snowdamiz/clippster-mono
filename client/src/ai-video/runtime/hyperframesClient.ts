import { invoke } from '@tauri-apps/api/core';
import { listen, type UnlistenFn } from '@tauri-apps/api/event';

type SidecarMessage =
  | { id: string | null; type: 'ready' }
  | { id: string; type: 'progress'; progress: number; stage?: string; message?: string }
  | { id: string; type: 'result'; data: unknown }
  | { id: string; type: 'error'; error: string; cancelled?: boolean };

interface Pending {
  resolve: (data: any) => void;
  reject: (error: Error) => void;
  onProgress?: (progress: number, stage?: string) => void;
}

export class HyperframesCancelledError extends Error {
  constructor() {
    super('Cancelled');
    this.name = 'HyperframesCancelledError';
  }
}

const pending = new Map<string, Pending>();
let unlisten: Promise<UnlistenFn> | null = null;

function ensureListener() {
  unlisten ??= listen<SidecarMessage>('hyperframes-message', ({ payload }) => {
    if (!payload.id) return;
    const entry = pending.get(payload.id);
    if (!entry) return;
    if (payload.type === 'progress') {
      entry.onProgress?.(payload.progress, payload.stage);
    } else if (payload.type === 'result') {
      pending.delete(payload.id);
      entry.resolve(payload.data);
    } else if (payload.type === 'error') {
      pending.delete(payload.id);
      entry.reject(payload.cancelled ? new HyperframesCancelledError() : new Error(payload.error));
    }
  });
  return unlisten;
}

export interface RequestOptions {
  signal?: AbortSignal;
  onProgress?: (progress: number, stage?: string) => void;
}

/** Send one operation to the Hyperframes sidecar and await its result. Aborting cancels it in the sidecar. */
export async function hyperframesRequest<T>(
  op: string,
  params: Record<string, unknown> = {},
  options: RequestOptions = {}
): Promise<T> {
  await ensureListener();
  if (options.signal?.aborted) throw new HyperframesCancelledError();
  const id = crypto.randomUUID();
  const result = new Promise<T>((resolve, reject) =>
    pending.set(id, { resolve, reject, onProgress: options.onProgress })
  );
  const onAbort = () =>
    void invoke('hyperframes_request', {
      request: { id: crypto.randomUUID(), op: 'cancel', target: id },
    });
  options.signal?.addEventListener('abort', onAbort, { once: true });
  try {
    await invoke('hyperframes_request', { request: { id, op, ...params } });
    return await result;
  } catch (error) {
    pending.delete(id);
    throw error;
  } finally {
    options.signal?.removeEventListener('abort', onAbort);
  }
}
