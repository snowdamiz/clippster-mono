import api from '@/services/api';
import type {
  Blueprint,
  EditDocument,
  GenerateBrief,
  MediaItem,
  ReferenceInfo,
  SessionSummary,
  SourceSegment,
  ToolResult,
  TurnResponse,
  VideoMeasurement,
  VideoPolicy,
  VideoRun,
  VideoSession,
} from './types';

export type SessionPatch = Partial<{
  name: string | null;
  request: string | null;
  media_items: MediaItem[];
  reference: ReferenceInfo | null;
  document: EditDocument | null;
  composition_files: Record<string, string>;
}>;

export async function getPolicy(): Promise<VideoPolicy> {
  return (await api.get('/ai/video/policy')).data;
}

export async function listSessions(): Promise<SessionSummary[]> {
  return (await api.get('/ai/video/sessions')).data.sessions;
}

export async function createSession(patch: SessionPatch = {}): Promise<VideoSession> {
  return (await api.post('/ai/video/sessions', patch)).data;
}

export async function getSession(id: number): Promise<VideoSession> {
  return (await api.get(`/ai/video/sessions/${id}`)).data;
}

export async function updateSession(id: number, patch: SessionPatch): Promise<VideoSession> {
  return (await api.patch(`/ai/video/sessions/${id}`, patch)).data;
}

export async function deleteSession(id: number): Promise<void> {
  await api.delete(`/ai/video/sessions/${id}`);
}

// -- Example analysis ------------------------------------------------------------------

export async function startReference(sessionId: number): Promise<number> {
  return (await api.post(`/ai/video/sessions/${sessionId}/reference/start`)).data.run_id;
}

export async function labelReferenceChunk(
  sessionId: number,
  runId: number,
  chunkIndex: number,
  video: string,
  shots: Array<{ index: number; start: number; end: number }>
): Promise<void> {
  await api.post(`/ai/video/sessions/${sessionId}/reference/chunk`, { run_id: runId, chunk_index: chunkIndex, video, shots });
}

export async function finishReference(
  sessionId: number,
  runId: number,
  measurement: Omit<VideoMeasurement, 'shots'> & { shots: Array<Omit<VideoMeasurement['shots'][number], 'keyframePath'>> },
  beats: unknown
): Promise<Blueprint> {
  return (await api.post(`/ai/video/sessions/${sessionId}/reference/finish`, { run_id: runId, measurement, beats })).data.blueprint;
}

// -- Agent runs ----------------------------------------------------------------------------

export async function startRun(sessionId: number, kind: 'generate' | 'revise', request: string): Promise<VideoRun> {
  return (await api.post(`/ai/video/sessions/${sessionId}/runs`, { kind, request })).data.run;
}

export async function labelSource(
  runId: number,
  body: { content_hash: string; chunk_key: string; chunk_start: number; kind: 'video' | 'photo'; media: string; segments: SourceSegment[] }
): Promise<SourceSegment[]> {
  return (await api.post(`/ai/video/runs/${runId}/label-source`, body)).data.segments;
}

export async function turn(runId: number, input: { brief?: GenerateBrief | Record<string, never>; results?: ToolResult[] }): Promise<TurnResponse> {
  return (await api.post(`/ai/video/runs/${runId}/turn`, input)).data;
}

export async function completeRun(
  runId: number,
  document: EditDocument,
  compositionFiles: Record<string, string>
): Promise<{ run: VideoRun; session: VideoSession }> {
  return (await api.post(`/ai/video/runs/${runId}/complete`, { document, composition_files: compositionFiles })).data;
}

export async function failRun(runId: number, reason: string): Promise<void> {
  await api.post(`/ai/video/runs/${runId}/fail`, { reason });
}

/** The server's `{ error }` message from an axios failure, or the error's own message. */
export function apiErrorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  const response = (error as { response?: { data?: { error?: unknown } } })?.response;
  const message = response?.data?.error;
  if (typeof message === 'string' && message) return message;
  return error instanceof Error && error.message ? error.message : fallback;
}

export function isPaymentRequired(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 402;
}
